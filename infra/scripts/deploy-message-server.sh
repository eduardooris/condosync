#!/usr/bin/env bash
# Deploy isolado do message-server — build local na VPS (sem GHCR).
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/condosync/infra}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-message-server] $*"; }

extra=()
[[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")

log "build + up message-server..."
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  "${extra[@]}" \
  --env-file "$ENV_FILE" \
  up -d --build --no-deps message-server

log "✓ message-server atualizado."
