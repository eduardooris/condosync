#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# init-ssl.sh — Emite certificados Let's Encrypt via Certbot
#
# Pré-requisitos:
#   - Domínios APP_DOMAIN e AUTH_DOMAIN apontando para o IP desta EC2
#   - Nginx rodando e respondendo na porta 80 (docker compose up -d)
#   - .env.prod preenchido com APP_DOMAIN e AUTH_DOMAIN
#
# Execute:
#   bash infra/scripts/init-ssl.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/.."
ENV_FILE="$INFRA_DIR/.env.prod"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não encontrado."
  exit 1
fi

# Carrega variáveis do .env.prod
set -a; source "$ENV_FILE"; set +a

: "${APP_DOMAIN:?APP_DOMAIN não definido em .env.prod}"
: "${AUTH_DOMAIN:?AUTH_DOMAIN não definido em .env.prod}"

EMAIL="${CERTBOT_EMAIL:-admin@${APP_DOMAIN}}"

echo "==> Emitindo certificado para: $APP_DOMAIN e $AUTH_DOMAIN"
echo "    E-mail: $EMAIL"

# Emite certificado usando webroot (nginx já deve estar rodando).
#
# IMPORTANTE: precisamos carregar os MESMOS compose files usados no
# `vps-up.sh`, senão `docker compose` reclama que o serviço `frontend`
# (definido em build.yml) não tem image nem build context.
docker compose \
  -f "$INFRA_DIR/docker-compose.prod.yml" \
  -f "$INFRA_DIR/docker-compose.api.yml" \
  -f "$INFRA_DIR/docker-compose.build.yml" \
  --env-file "$ENV_FILE" \
  --profile certbot \
  run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$APP_DOMAIN" \
    -d "$AUTH_DOMAIN"

echo ""
echo "==> Certificado emitido com sucesso!"
echo ""
echo "Próximos passos:"
echo "  1. Edite infra/nginx/nginx.conf:"
echo "     - Comente os blocos HTTP simples"
echo "     - Descomente os blocos HTTPS"
echo "     - Substitua APP_DOMAIN e AUTH_DOMAIN pelos seus domínios reais"
echo "  2. Recarregue o nginx:"
echo "       docker exec condosync-nginx nginx -s reload"
echo ""
INFRA_ABS="$(realpath "$INFRA_DIR")"
echo "Renovação automática (adicione ao crontab -e):"
echo "  0 3 * * 1 docker compose \\"
echo "    -f $INFRA_ABS/docker-compose.prod.yml \\"
echo "    -f $INFRA_ABS/docker-compose.api.yml \\"
echo "    -f $INFRA_ABS/docker-compose.build.yml \\"
echo "    --env-file $INFRA_ABS/.env.prod \\"
echo "    --profile certbot run --rm certbot renew --quiet \\"
echo "    && docker exec condosync-nginx nginx -s reload"
