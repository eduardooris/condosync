#!/usr/bin/env bash
# Deploy isolado do frontend — build local na VPS (sem GHCR).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-frontend] $*"; }

extra=()
[[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")

log "build + up frontend..."
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  "${extra[@]}" \
  --env-file "$ENV_FILE" \
  up -d --build --no-deps frontend

log "✓ frontend atualizado."
