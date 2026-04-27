#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Atualiza e reinicia os containers em produção
#
# Execute a partir da raiz do projeto:
#   bash infra/scripts/deploy.sh
#
# Ou com tag específica:
#   IMAGE_TAG=v1.2.3 bash infra/scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/.."
PROJECT_DIR="$INFRA_DIR/.."
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
ENV_FILE="$INFRA_DIR/.env.prod"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não encontrado."
  echo "Copie e preencha: cp infra/.env.prod.example infra/.env.prod"
  exit 1
fi

echo "==> [1/4] Atualizando código..."
cd "$PROJECT_DIR"
git pull --ff-only

echo "==> [2/4] Fazendo build das imagens (tag: $IMAGE_TAG)..."
cd "$INFRA_DIR"
IMAGE_TAG="$IMAGE_TAG" docker compose \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  build --no-cache api frontend

echo "==> [3/4] Subindo containers..."
IMAGE_TAG="$IMAGE_TAG" docker compose \
  -f docker-compose.prod.yml \
  --env-file .env.prod \
  up -d --remove-orphans

echo "==> [4/4] Limpando imagens antigas..."
docker image prune -f

echo ""
echo "✓ Deploy concluído!"
echo ""
echo "Logs da API:      docker logs -f condosync-api"
echo "Logs do Nginx:    docker logs -f condosync-nginx"
echo "Logs do Keycloak: docker logs -f condosync-keycloak"
echo "Status:           docker compose -f infra/docker-compose.prod.yml ps"
