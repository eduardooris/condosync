#!/usr/bin/env bash
# Sobe produção na VPS com build local (sem GHCR).
#
# Mesmo compose pra DNS+TLS e IP-only — o que muda é o .env.prod:
#   DNS+TLS:  cp infra/.env.prod.example         infra/.env.prod
#   IP-only:  cp infra/.env.prod.ip-only.example infra/.env.prod
#
# Depois:    ./scripts/vps-up.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infra"

ENV_FILE="${ENV_FILE:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Crie $ROOT/infra/.env.prod (ver .env.prod.example ou .env.prod.ip-only.example)" >&2
  exit 1
fi

echo "▶ Build + up (postgres, keycloak, api, frontend, message-server, nginx)..."
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  --env-file "$ENV_FILE" \
  up -d --build "$@"

echo "▶ Aguarde Keycloak (~1–2 min). Logs: docker logs condosync-api -f"
