#!/usr/bin/env bash
# Rebuild de um serviço: ./scripts/vps-rebuild.sh [-f docker-compose.ip-only.yml] api
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infra"

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

TARGET="${1:?Uso: $0 [-f docker-compose.ip-only.yml] api|frontend|message-server}"

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  "${EXTRA[@]}" \
  --env-file .env.prod \
  up -d --build --no-deps "$TARGET"
