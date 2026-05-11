#!/usr/bin/env bash
# CondoSync — orquestrador do stack de desenvolvimento.
#
# Comandos:
#   ./scripts/dev.sh up       Sobe deps + api + message-server (build se preciso)
#   ./scripts/dev.sh deps     Sobe só Postgres/Redis/Keycloak/MinIO
#   ./scripts/dev.sh api      Rebuild + restart só da API
#   ./scripts/dev.sh msg      Rebuild + restart só do message-server
#   ./scripts/dev.sh down     Derruba todos os serviços (volumes preservados)
#   ./scripts/dev.sh nuke     Derruba TUDO e apaga volumes (dados perdidos)
#   ./scripts/dev.sh ps       Status dos serviços
#   ./scripts/dev.sh logs <svc>  Tail dos logs de um serviço

set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cd "$HERE"

DEPS=infra/dev/docker-compose.deps.yml
API=infra/dev/docker-compose.api.yml
MSG=infra/dev/docker-compose.message-server.yml

case "${1:-up}" in
  up)
    docker compose up -d --build
    ;;
  deps)
    docker compose -f "$DEPS" up -d
    ;;
  api)
    docker compose -f "$API" up -d --build --no-deps api
    ;;
  msg|message-server)
    docker compose -f "$MSG" up -d --build --no-deps message-server
    ;;
  down)
    docker compose down
    ;;
  nuke)
    read -p "Apagar TODOS os volumes (postgres, keycloak, minio)? [y/N] " confirm
    [[ "$confirm" == "y" || "$confirm" == "Y" ]] || { echo "abortado"; exit 1; }
    docker compose down -v
    ;;
  ps)
    docker compose ps
    ;;
  logs)
    shift
    docker compose logs -f --tail=200 "$@"
    ;;
  *)
    echo "uso: $0 [up|deps|api|msg|down|nuke|ps|logs <svc>]" >&2
    exit 1
    ;;
esac
