#!/usr/bin/env bash
# Deploy isolado da API — build local na VPS (sem GHCR).
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/condosync/infra}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-api] $*"; }

compose() {
  local extra=()
  [[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")
  docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.api.yml \
    -f docker-compose.build.yml \
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

log "build + up api..."
compose up -d --build --no-deps api

if wait_healthy; then
  log "✓ deploy concluído."
  exit 0
fi

log "✗ healthcheck falhou — investigue: docker logs condosync-api --tail=80"
exit 1
