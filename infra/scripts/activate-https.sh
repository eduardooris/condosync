#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# activate-https.sh — Ativa o modo HTTPS no `infra/nginx/nginx.conf`.
#
# O template `nginx.conf` versionado deixa os blocos HTTP "temporários" ativos
# (necessários para o desafio HTTP-01 do Let's Encrypt na primeira emissão) e
# os blocos HTTPS comentados, com `APP_DOMAIN` / `AUTH_DOMAIN` como placeholders.
#
# Este script faz a transição one-shot pós-`init-ssl.sh`:
#   1. Remove os blocos HTTP "App" e "Auth" temporários.
#   2. Descomenta o redirect `:80 → :443` (preservando o handler ACME).
#   3. Descomenta os dois blocos HTTPS.
#   4. Substitui `APP_DOMAIN` / `AUTH_DOMAIN` pelos domínios reais.
#   5. Aponta o cert do AUTH_DOMAIN para o mesmo path do APP_DOMAIN
#      (certbot grava o SAN multi-domínio no diretório do primeiro `-d`).
#
# IMPORTANTE: filtra linhas decorativas (cabeçalhos `# ── ─── ──`) para não
# descomentá-las acidentalmente — nginx interpretaria `──` como diretiva
# inválida e o container entraria em restart loop.
#
# Idempotente: rodar duas vezes não dá erro (apenas no-op na segunda).
#
# Uso:
#   bash infra/scripts/activate-https.sh <APP_DOMAIN> <AUTH_DOMAIN>
#
# Exemplo:
#   bash infra/scripts/activate-https.sh condosync.duckdns.org condosync-auth.duckdns.org
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Uso: $0 <APP_DOMAIN> <AUTH_DOMAIN>" >&2
  echo "Exemplo: $0 condosync.duckdns.org condosync-auth.duckdns.org" >&2
  exit 1
fi

APP_DOMAIN="$1"
AUTH_DOMAIN="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_CONF="$(cd "$SCRIPT_DIR/.." && pwd)/nginx/nginx.conf"

if [[ ! -f "$NGINX_CONF" ]]; then
  echo "ERRO: $NGINX_CONF não encontrado." >&2
  exit 1
fi

# Idempotência: se já encontrar `listen 443 ssl` ativo (não comentado),
# considera que a ativação já foi feita.
if grep -E '^[[:space:]]*listen 443 ssl' "$NGINX_CONF" >/dev/null 2>&1; then
  echo "==> nginx.conf já em modo HTTPS (listen 443 ssl ativo). No-op."
  echo "    Se quiser refazer, descarte o arquivo:  git checkout -- $NGINX_CONF"
  exit 0
fi

# Sanity: verifica que os marcadores esperados existem no template.
if ! grep -q "── HTTPS — descomente" "$NGINX_CONF"; then
  echo "ERRO: template nginx.conf não tem o cabeçalho HTTPS esperado." >&2
  echo "      O script foi feito para o template versionado deste repo." >&2
  exit 1
fi

BACKUP="$NGINX_CONF.before-activate-https"
cp "$NGINX_CONF" "$BACKUP"
echo "==> backup salvo em: $BACKUP"

# Localiza os ranges dinamicamente — robusto a edições futuras do template.
LINE_REDIRECT_BLOCK_START=$(grep -n "^  # ── HTTP → HTTPS redirect" "$NGINX_CONF" | head -1 | cut -d: -f1)
LINE_HTTP_APP_HEADER=$(grep -n "^  # ── App — HTTP (temporário" "$NGINX_CONF" | head -1 | cut -d: -f1)
LINE_HTTPS_HEADER=$(grep -n "^  # ─── HTTPS — descomente" "$NGINX_CONF" | head -1 | cut -d: -f1)

if [[ -z "$LINE_REDIRECT_BLOCK_START" || -z "$LINE_HTTP_APP_HEADER" || -z "$LINE_HTTPS_HEADER" ]]; then
  echo "ERRO: não consegui localizar marcadores no template." >&2
  echo "      redirect=$LINE_REDIRECT_BLOCK_START app_http=$LINE_HTTP_APP_HEADER https=$LINE_HTTPS_HEADER" >&2
  exit 1
fi

# Range do redirect comentado: do "# server {" abaixo do cabeçalho até o "# }".
LINE_REDIRECT_OPEN=$((LINE_REDIRECT_BLOCK_START + 1))
LINE_REDIRECT_CLOSE=$(awk -v start="$LINE_REDIRECT_OPEN" 'NR>=start && /^  # \}/ {print NR; exit}' "$NGINX_CONF")

# Range dos blocos HTTP temporários: do header App até a linha anterior ao header HTTPS.
LINE_HTTP_DELETE_START="$LINE_HTTP_APP_HEADER"
LINE_HTTP_DELETE_END=$((LINE_HTTPS_HEADER - 1))

# Range dos blocos HTTPS comentados: do header HTTPS até o último "# }" antes do fechamento do http{}.
LINE_HTTPS_LAST=$(awk -v start="$LINE_HTTPS_HEADER" 'NR>=start && /^  # \}/ {last=NR} END {print last}' "$NGINX_CONF")

echo "==> ranges: redirect=[$LINE_REDIRECT_OPEN-$LINE_REDIRECT_CLOSE] http_delete=[$LINE_HTTP_DELETE_START-$LINE_HTTP_DELETE_END] https=[$LINE_HTTPS_HEADER-$LINE_HTTPS_LAST]"

# sed com filtro `/──/!{ ... }` em cada range descomentável: nunca toca
# nas linhas decorativas (cabeçalhos com `── ─── ──`).
sed -i.bak \
  -e "${LINE_REDIRECT_OPEN},${LINE_REDIRECT_CLOSE} { /──/!{ s/^  # /  /; s/^  #$//; } }" \
  -e "${LINE_HTTP_DELETE_START},${LINE_HTTP_DELETE_END} d" \
  -e "${LINE_HTTPS_HEADER},${LINE_HTTPS_LAST} { /──/!{ s/^  # /  /; s/^  #$//; } }" \
  -e "s/APP_DOMAIN/${APP_DOMAIN}/g" \
  -e "s/AUTH_DOMAIN/${AUTH_DOMAIN}/g" \
  -e "s|/etc/letsencrypt/live/${AUTH_DOMAIN}/|/etc/letsencrypt/live/${APP_DOMAIN}/|g" \
  "$NGINX_CONF"

rm -f "${NGINX_CONF}.bak"

# Verifica que ficou pelo menos 2 ocorrências de `location /socket.io/`
# (uma no HTTP redirect — nenhuma; mas duas nos blocos HTTPS).
COUNT_SOCKETIO=$(grep -c "^    location /socket.io/" "$NGINX_CONF" || true)
COUNT_LISTEN_443=$(grep -c "^    listen 443 ssl" "$NGINX_CONF" || true)

if [[ "$COUNT_LISTEN_443" -lt 2 ]]; then
  echo "ERRO: esperava 2x 'listen 443 ssl' após ativação, encontrei $COUNT_LISTEN_443." >&2
  echo "      Restaurando backup." >&2
  cp "$BACKUP" "$NGINX_CONF"
  exit 1
fi

echo "==> ativação concluída: ${COUNT_LISTEN_443}x 'listen 443 ssl', ${COUNT_SOCKETIO}x 'location /socket.io/'"
echo ""
echo "Próximos passos:"
echo "  1. Valide a config:"
echo "       docker exec condosync-nginx nginx -t"
echo "  2. Recarregue:"
echo "       docker exec condosync-nginx nginx -s reload"
echo "  3. Teste o handshake do Socket.IO:"
echo "       curl -s 'https://${APP_DOMAIN}/socket.io/?EIO=4&transport=polling' | head -c 200"
echo ""
echo "Se algo quebrar, restaure:"
echo "       cp $BACKUP $NGINX_CONF"
