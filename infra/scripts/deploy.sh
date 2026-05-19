#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Deploy completo em produção (git pull + build local na VPS)
#
# Usa os mesmos três compose files que scripts/vps-up.sh (sem GHCR).
# Execute a partir da raiz do projeto:
#   bash infra/scripts/deploy.sh
#
# Para atualizar apenas um serviço, use scripts/vps-rebuild.sh ou deploy-api.sh etc.
#
# Rollback após git checkout manual:
#   SKIP_GIT_PULL=1 bash infra/scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$INFRA_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$INFRA_DIR/.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não encontrado." >&2
  echo "Copie e preencha: cp infra/.env.prod.example infra/.env.prod" >&2
  exit 1
fi

echo "==> [1/3] Atualizando código..."
cd "$PROJECT_DIR"
if [[ "${SKIP_GIT_PULL:-0}" == "1" ]]; then
  echo "(SKIP_GIT_PULL=1 — não executando git pull)"
else
  git pull --ff-only
fi

echo "==> [2/3] Build + subindo stack (prod + api + build)..."
cd "$INFRA_DIR"
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.api.yml \
  -f docker-compose.build.yml \
  --env-file "$ENV_FILE" \
  up -d --build --remove-orphans

echo "==> [3/3] Limpando imagens antigas..."
docker image prune -f

echo ""
echo "✓ Deploy concluído."
echo ""
echo "Logs da API: docker logs -f condosync-api"
echo "Logs do Nginx: docker logs -f condosync-nginx"
echo "Status: cd infra && docker compose -f docker-compose.prod.yml -f docker-compose.api.yml -f docker-compose.build.yml --env-file .env.prod ps"
