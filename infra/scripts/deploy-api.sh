#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-api.sh — Deploy isolado da API via GHCR (pull de imagem + healthcheck
#                 + rollback automático para a imagem anterior em caso de falha).
#
# Chamado pelo workflow .github/workflows/backend-release.yml (via SSH), mas
# também roda na mão na VPS.
#
# Variáveis:
#   GHCR_OWNER          (obrigatório) owner do GHCR, minúsculo. Ex.: condosync
#   IMAGE_TAG           (default: latest) tag da imagem condosync-api a subir
#   GHCR_USER/GHCR_TOKEN (opcional) credenciais p/ `docker login ghcr.io`
#                        — necessárias se o pacote for privado
#   ENV_FILE            (default: ../.env.prod)
#   HEALTH_RETRIES      (default: 30) tentativas de healthcheck (x3s)
#   EXTRA_COMPOSE_FILE  (opcional) override extra (ex.: IP-only)
#
# Build local (sem GHCR) continua disponível em ../scripts/vps-rebuild.sh api.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

export GHCR_OWNER="${GHCR_OWNER:?defina GHCR_OWNER (owner do GHCR, minúsculo)}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-api] $*"; }

compose() {
  local extra=()
  [[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")
  docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.api.yml \
    -f docker-compose.ghcr.yml \
    "${extra[@]}" \
    --env-file "$ENV_FILE" \
    "$@"
}

wait_healthy() {
  local i status
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    status=$(docker inspect --format '{{.State.Health.Status}}' condosync-api 2>/dev/null || echo starting)
    if [[ "$status" == "healthy" ]]; then
      log "container saudável após ${i} tentativas."
      return 0
    fi
    log "aguardando healthcheck... (${i}/${HEALTH_RETRIES}) status=$status"
    sleep 3
  done
  return 1
}

# Login opcional (necessário se o pacote no GHCR for privado).
if [[ -n "${GHCR_TOKEN:-}" ]]; then
  log "docker login ghcr.io..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-$GHCR_OWNER}" --password-stdin
fi

# Guarda a imagem atual para rollback.
PREV_IMAGE="$(docker inspect --format '{{.Config.Image}}' condosync-api 2>/dev/null || echo '')"
PREV_TAG="${PREV_IMAGE##*:}"

log "pull + up api (tag=${IMAGE_TAG})..."
compose pull api
compose up -d --no-deps api

if wait_healthy; then
  log "✓ deploy concluído (tag=${IMAGE_TAG})."
  exit 0
fi

log "✗ healthcheck falhou para tag=${IMAGE_TAG}."
if [[ -n "$PREV_TAG" && "$PREV_TAG" != "$IMAGE_TAG" ]]; then
  log "↩ rollback para imagem anterior (tag=${PREV_TAG})..."
  IMAGE_TAG="$PREV_TAG" compose up -d --no-deps api
  if IMAGE_TAG="$PREV_TAG" wait_healthy; then
    log "✓ rollback concluído — produção de volta na tag ${PREV_TAG}."
  else
    log "✗ rollback TAMBÉM falhou — intervenção manual necessária."
  fi
else
  log "sem imagem anterior conhecida para rollback."
fi
log "investigue: docker logs condosync-api --tail=80"
exit 1
