#!/usr/bin/env bash
# Sobe produção na VPS com build local (sem GHCR).
# IP-only: ./scripts/vps-up.sh -f docker-compose.ip-only.yml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infra"

ENV_FILE="${ENV_FILE:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Crie $ROOT/infra/.env.prod (cp .env.prod.example .env.prod)" >&2
  exit 1
fi

EXTRA=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)
      EXTRA+=(-f "$2")
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

echo "▶ Build + up (postgres, keycloak, api, frontend, message-server, nginx)..."
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  "${EXTRA[@]}" \
  --env-file "$ENV_FILE" \
  up -d --build "$@"

echo "▶ Aguarde Keycloak (~1–2 min). Logs: docker logs condosync-api -f"
