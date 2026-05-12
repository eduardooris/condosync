#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/deploy.sh — Atualiza a VPS a partir do código já buildado no host.
#
# Uso (na raiz do repo, na EC2):
#   ./scripts/deploy.sh              # git pull + rebuilda API + frontend
#   ./scripts/deploy.sh api          # só rebuilda a API
#   ./scripts/deploy.sh frontend     # só rebuilda o frontend
#   ./scripts/deploy.sh pull         # só atualiza o código, não rebuilda
#
# Variáveis (defaults pra produção do MVP no DuckDNS):
#   PUBLIC_URL        — domínio público do app  (default condosync.duckdns.org)
#   AUTH_URL          — domínio público do auth (default condosync-auth.duckdns.org)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PUBLIC_URL="${PUBLIC_URL:-https://condosync.duckdns.org}"
AUTH_URL="${AUTH_URL:-https://condosync-auth.duckdns.org}"
TARGET="${1:-all}"

cd "$(dirname "$0")/.."

step() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }

deploy_pull() {
  step "git pull"
  git pull --ff-only
}

deploy_api() {
  step "Rebuild API"
  docker compose up -d --build api
}

deploy_frontend() {
  step "Rebuild frontend ($PUBLIC_URL)"
  cd frontend
  docker rm -f condosync-frontend 2>/dev/null || true
  docker build --no-cache \
    --build-arg VITE_API_BASE_URL="$PUBLIC_URL" \
    --build-arg VITE_KEYCLOAK_URL="$AUTH_URL" \
    --build-arg VITE_KEYCLOAK_REALM=main \
    --build-arg VITE_KEYCLOAK_CLIENT_ID=main-frontend \
    -t condosync-frontend:local .
  docker run -d \
    --name condosync-frontend \
    --restart unless-stopped \
    --network condosync_dev \
    -p 127.0.0.1:8090:80 \
    condosync-frontend:local
  cd ..
}

case "$TARGET" in
  pull) deploy_pull ;;
  api) deploy_pull; deploy_api ;;
  frontend|front|fe) deploy_pull; deploy_frontend ;;
  all|"") deploy_pull; deploy_api; deploy_frontend ;;
  *)
    echo "Uso: $0 [all|api|frontend|pull]" >&2
    exit 1
    ;;
esac

step "Pronto."
echo "App:   $PUBLIC_URL"
echo "Auth:  $AUTH_URL"
