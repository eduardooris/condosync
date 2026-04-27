#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/condosync/infra}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
MESSAGE_SERVER_IMAGE="${MESSAGE_SERVER_IMAGE:-ghcr.io/condosync/condosync-message-server}"
PREVIOUS_TAG_FILE="${PREVIOUS_TAG_FILE:-$COMPOSE_DIR/.message-server-previous-tag}"
HEALTH_RETRIES="${HEALTH_RETRIES:-35}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

: "${MESSAGE_SERVER_TAG:?MESSAGE_SERVER_TAG não definido (use o SHA da imagem message-server)}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-message-server] $*"; }

compose() {
  local extra=()
  [[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")
  MESSAGE_SERVER_TAG="$1" MESSAGE_SERVER_IMAGE="$MESSAGE_SERVER_IMAGE" docker compose \
    -f docker-compose.prod.yml \
    "${extra[@]}" \
    --env-file "$ENV_FILE" \
    "${@:2}"
}

wait_healthy() {
  local i status
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    status=$(docker inspect --format '{{.State.Health.Status}}' condosync-message-server 2>/dev/null || echo starting)
    if [[ "$status" == "healthy" ]]; then
      log "message-server saudável após ${i} tentativas."
      return 0
    fi
    log "aguardando healthcheck... (${i}/${HEALTH_RETRIES}) status=$status"
    sleep 3
  done
  return 1
}

if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USER:-}" ]]; then
  log "autenticando no ghcr.io..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi

CURRENT_TAG=""
if docker inspect condosync-message-server >/dev/null 2>&1; then
  CURRENT_TAG=$(docker inspect --format '{{.Config.Image}}' condosync-message-server | awk -F: '{print $NF}')
  log "tag atualmente rodando: $CURRENT_TAG"
fi

log "fazendo pull de $MESSAGE_SERVER_IMAGE:$MESSAGE_SERVER_TAG..."
compose "$MESSAGE_SERVER_TAG" pull message-server

log "subindo nova versão do message-server ($MESSAGE_SERVER_TAG)..."
compose "$MESSAGE_SERVER_TAG" up -d --no-deps message-server

if wait_healthy; then
  if [[ -n "$CURRENT_TAG" && "$CURRENT_TAG" != "$MESSAGE_SERVER_TAG" ]]; then
    echo "$CURRENT_TAG" > "$PREVIOUS_TAG_FILE"
  fi
  log "✓ deploy concluído com sucesso."
  exit 0
fi

log "✗ healthcheck falhou — iniciando rollback."
ROLLBACK_TAG=""
if [[ -f "$PREVIOUS_TAG_FILE" ]]; then
  ROLLBACK_TAG=$(cat "$PREVIOUS_TAG_FILE")
elif [[ -n "$CURRENT_TAG" ]]; then
  ROLLBACK_TAG="$CURRENT_TAG"
fi

if [[ -z "$ROLLBACK_TAG" ]]; then
  log "✗ não há tag anterior conhecida para rollback."
  exit 2
fi

compose "$ROLLBACK_TAG" up -d --no-deps message-server
if wait_healthy; then
  log "✓ rollback concluído."
  exit 1
fi

log "✗ rollback também falhou. AÇÃO MANUAL NECESSÁRIA."
exit 3
