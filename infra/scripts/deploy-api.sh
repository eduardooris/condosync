#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# CondoSync — Deploy isolado da API
#
# Atualiza SOMENTE o serviço `api` (sem tocar em postgres/redis/keycloak/
# nginx/frontend). Faz pull da imagem do GHCR, sobe a nova versão, espera
# o healthcheck e — em caso de falha — faz rollback para a tag anterior.
#
# Variáveis obrigatórias (export ou via systemd EnvironmentFile):
#   GHCR_USER          — usuário/organização do GitHub
#   GHCR_TOKEN         — PAT com escopo `read:packages`
#   IMAGE_TAG          — SHA do commit (ou "latest" para fallback manual)
#
# Variáveis opcionais:
#   COMPOSE_DIR        — default: /opt/condosync/infra
#   ENV_FILE           — default: $COMPOSE_DIR/.env.prod
#   API_IMAGE          — default: ghcr.io/condosync/condosync-api
#   PREVIOUS_TAG_FILE  — default: $COMPOSE_DIR/.api-previous-tag
#   HEALTH_RETRIES     — default: 30 (× 3s = 90s)
#   EXTRA_COMPOSE_FILE — opcional. Caminho extra para `-f` (ex.:
#                        docker-compose.ip-only.yml em modo IP-only sem DNS).
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/condosync/infra}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
API_IMAGE="${API_IMAGE:-ghcr.io/condosync/condosync-api}"
PREVIOUS_TAG_FILE="${PREVIOUS_TAG_FILE:-$COMPOSE_DIR/.api-previous-tag}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
EXTRA_COMPOSE_FILE="${EXTRA_COMPOSE_FILE:-}"

: "${IMAGE_TAG:?IMAGE_TAG não definido (use o SHA do commit)}"

cd "$COMPOSE_DIR"

log() { echo "[deploy-api] $*"; }

compose() {
  local extra=()
  [[ -n "$EXTRA_COMPOSE_FILE" ]] && extra=(-f "$EXTRA_COMPOSE_FILE")
  IMAGE_TAG="$1" API_IMAGE="$API_IMAGE" docker compose \
    -f docker-compose.prod.yml \
    -f docker-compose.api.yml \
    "${extra[@]}" \
    --env-file "$ENV_FILE" \
    "${@:2}"
}

wait_healthy() {
  local i status
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    status=$(docker inspect --format '{{.State.Health.Status}}' condosync-api 2>/dev/null || echo starting)
    if [[ "$status" == "healthy" ]]; then
      log "container saudável após ${i} tentativas."
      return 0
    fi
    log "aguardando healthcheck... (${i}/${HEALTH_RETRIES}) status=$status"
    sleep 3
  done
  return 1
}

# 1) Login no GHCR (silencioso, idempotente)
if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USER:-}" ]]; then
  log "autenticando no ghcr.io..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
fi

# 2) Captura a tag atualmente em produção (para rollback)
CURRENT_TAG=""
if docker inspect condosync-api >/dev/null 2>&1; then
  CURRENT_TAG=$(docker inspect --format '{{.Config.Image}}' condosync-api | awk -F: '{print $NF}')
  log "tag atualmente rodando: $CURRENT_TAG"
fi

# 3) Pull da nova imagem
log "fazendo pull de $API_IMAGE:$IMAGE_TAG..."
compose "$IMAGE_TAG" pull api

# 4) Sobe sem mexer nas dependências
log "subindo nova versão da api ($IMAGE_TAG)..."
compose "$IMAGE_TAG" up -d --no-deps api

# 5) Aguarda healthcheck
if wait_healthy; then
  # Sucesso: persiste a tag para o próximo rollback
  if [[ -n "$CURRENT_TAG" && "$CURRENT_TAG" != "$IMAGE_TAG" ]]; then
    echo "$CURRENT_TAG" > "$PREVIOUS_TAG_FILE"
    log "tag anterior ($CURRENT_TAG) gravada em $PREVIOUS_TAG_FILE."
  fi
  log "✓ deploy concluído com sucesso."
  exit 0
fi

# 6) Falha → rollback
log "✗ healthcheck falhou — iniciando rollback."
ROLLBACK_TAG=""
if [[ -f "$PREVIOUS_TAG_FILE" ]]; then
  ROLLBACK_TAG=$(cat "$PREVIOUS_TAG_FILE")
elif [[ -n "$CURRENT_TAG" ]]; then
  ROLLBACK_TAG="$CURRENT_TAG"
fi

if [[ -z "$ROLLBACK_TAG" ]]; then
  log "✗ não há tag anterior conhecida para rollback. Investigue manualmente."
  exit 2
fi

log "voltando para $ROLLBACK_TAG..."
compose "$ROLLBACK_TAG" up -d --no-deps api
if wait_healthy; then
  log "✓ rollback concluído. Versão $IMAGE_TAG NÃO foi promovida."
  exit 1
fi

log "✗ rollback também falhou. AÇÃO MANUAL NECESSÁRIA."
exit 3
