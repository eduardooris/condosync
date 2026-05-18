#!/usr/bin/env bash
# Rebuild isolado de um serviço em produção.
# Uso:  ./scripts/vps-rebuild.sh api | frontend | message-server
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infra"

TARGET="${1:?Uso: $0 api|frontend|message-server}"

docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  --env-file .env.prod \
  up -d --build --no-deps "$TARGET"
