#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/condosync/infra}"
REPO_ROOT="${REPO_ROOT:-$(cd "$COMPOSE_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-}"
if [[ -z "$ENV_FILE" ]]; then
  [[ -f "$REPO_ROOT/.env" ]] && ENV_FILE="$REPO_ROOT/.env" || ENV_FILE="$COMPOSE_DIR/.env.prod"
fi
FRONTEND_IMAGE="${FRONTEND_IMAGE:-ghcr.io/condosync/condosync-frontend}"
PREVIOUS_TAG_FILE="${PREVIOUS_TAG_FILE:-$COMPOSE_DIR/.frontend-previous-tag}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

: "${FRONTEND_TAG:?FRONTEND_TAG não definido (use o SHA da imagem frontend)}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-frontend] $*"; }

compose() {
  local extra=()
  [[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")
  FRONTEND_TAG="$1" FRONTEND_IMAGE="$FRONTEND_IMAGE" docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.api.yml \
    "${extra[@]}" \
    --env-file "$ENV_FILE" \
    "${@:2}"
}

wait_healthy() {
  local i status
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    status=$(docker inspect --format '{{.State.Status}}' condosync-frontend 2>/dev/null || echo starting)
    if [[ "$status" == "running" ]]; then
      log "frontend rodando após ${i} tentativas."
      return 0
    fi
    log "aguardando frontend... (${i}/${HEALTH_RETRIES}) status=$status"
    sleep 2
  done
  return 1
}

if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USER:-}" ]]; then
  log "autenticando no ghcr.io..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi

CURRENT_TAG=""
if docker inspect condosync-frontend >/dev/null 2>&1; then
  CURRENT_TAG=$(docker inspect --format '{{.Config.Image}}' condosync-frontend | awk -F: '{print $NF}')
  log "tag atualmente rodando: $CURRENT_TAG"
fi

log "fazendo pull de $FRONTEND_IMAGE:$FRONTEND_TAG..."
compose "$FRONTEND_TAG" pull frontend

log "subindo nova versão do frontend ($FRONTEND_TAG)..."
compose "$FRONTEND_TAG" up -d --no-deps frontend

if wait_healthy; then
  if [[ -n "$CURRENT_TAG" && "$CURRENT_TAG" != "$FRONTEND_TAG" ]]; then
    echo "$CURRENT_TAG" > "$PREVIOUS_TAG_FILE"
  fi
  log "✓ deploy concluído com sucesso."
  exit 0
fi

log "✗ frontend não ficou saudável — iniciando rollback."
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

compose "$ROLLBACK_TAG" up -d --no-deps frontend
if wait_healthy; then
  log "✓ rollback concluído."
  exit 1
fi

log "✗ rollback também falhou. AÇÃO MANUAL NECESSÁRIA."
exit 3
