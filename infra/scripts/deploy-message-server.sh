#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-message-server.sh — Deploy isolado do message-server via GHCR (pull + up).
#
# Variáveis:
#   GHCR_OWNER          (obrigatório) owner do GHCR, minúsculo
#   MESSAGE_SERVER_TAG  (default: latest) tag da imagem condosync-message-server
#   GHCR_USER/GHCR_TOKEN (opcional) credenciais p/ `docker login ghcr.io`
#   ENV_FILE            (default: ../.env.prod)
#   EXTRA_COMPOSE_FILE  (opcional) override extra (ex.: IP-only)
#
# Imagem distroless sem healthcheck nativo (ver nota em docker-compose.prod.yml).
# Build local continua em ../scripts/vps-rebuild.sh message-server.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

export GHCR_OWNER="${GHCR_OWNER:?defina GHCR_OWNER (owner do GHCR, minúsculo)}"
export MESSAGE_SERVER_TAG="${MESSAGE_SERVER_TAG:-latest}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-message-server] $*"; }

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  log "docker login ghcr.io..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-$GHCR_OWNER}" --password-stdin
fi

extra=()
[[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")

log "pull + up message-server (tag=${MESSAGE_SERVER_TAG})..."
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.ghcr.yml \
  "${extra[@]}" \
  --env-file "$ENV_FILE" \
  pull message-server

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.ghcr.yml \
  "${extra[@]}" \
  --env-file "$ENV_FILE" \
  up -d --no-deps message-server

log "✓ message-server atualizado (tag=${MESSAGE_SERVER_TAG})."
