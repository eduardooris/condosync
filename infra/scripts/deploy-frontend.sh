#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-frontend.sh — Deploy isolado do frontend via GHCR (pull + up).
#
# Variáveis:
#   GHCR_OWNER          (obrigatório) owner do GHCR, minúsculo
#   FRONTEND_TAG        (default: latest) tag da imagem condosync-frontend
#   GHCR_USER/GHCR_TOKEN (opcional) credenciais p/ `docker login ghcr.io`
#   ENV_FILE            (default: ../.env.prod)
#   EXTRA_COMPOSE_FILE  (opcional) override extra (ex.: IP-only)
#
# As VITE_* são baked na imagem em build-time pelo workflow de release; aqui só
# puxamos a imagem pronta. Build local continua em ../scripts/vps-rebuild.sh frontend.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

export GHCR_OWNER="${GHCR_OWNER:?defina GHCR_OWNER (owner do GHCR, minúsculo)}"
export FRONTEND_TAG="${FRONTEND_TAG:-latest}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-frontend] $*"; }

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  log "docker login ghcr.io..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-$GHCR_OWNER}" --password-stdin
fi

extra=()
[[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")

log "pull + up frontend (tag=${FRONTEND_TAG})..."
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.ghcr.yml \
  "${extra[@]}" \
  --env-file "$ENV_FILE" \
  pull frontend

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.ghcr.yml \
  "${extra[@]}" \
  --env-file "$ENV_FILE" \
  up -d --no-deps frontend

log "✓ frontend atualizado (tag=${FRONTEND_TAG})."
