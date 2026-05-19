#!/usr/bin/env bash
# CondoSync · Asaas sandbox smoke test
#
# Valida que sua apiKey master, conectividade e payload estão OK ANTES de
# escrever uma linha de código. Roda os 4 endpoints essenciais do plano de
# integração (ver docs/06_pagamentos_asaas.md §15):
#
#   1. GET  /customers           — apiKey válida e Asaas responsivo
#   2. POST /customers           — cria pagador de teste
#   3. POST /payments            — cria cobrança Pix em nome do pagador
#   4. GET  /payments/{id}/pixQrCode — recupera QR + copia-cola
#
# Pré-requisitos:
#   - Conta criada em https://sandbox.asaas.com
#   - apiKey master gerada (Configurações > Integrações > Chave de API)
#   - jq instalado (brew install jq)
#
# Uso:
#   ASAAS_MASTER_API_KEY=$(cat ~/secret.txt) ./scripts/asaas-smoke-test.sh
# ou:
#   export ASAAS_MASTER_API_KEY=...
#   ./scripts/asaas-smoke-test.sh
#
# Tudo é executado contra o sandbox. Em caso de erro, mostra HTTP status +
# corpo da resposta pra você debugar.

set -euo pipefail

# ── Config (overrides: ASAAS_TEST_CPF, ASAAS_TEST_PHONE, ASAAS_TEST_EMAIL, ASAAS_TEST_BIRTH) ──
ASAAS_BASE="${ASAAS_API_BASE_URL:-https://api-sandbox.asaas.com/v3}"
TEST_CPF="${ASAAS_TEST_CPF:-24971563792}"
TEST_NAME="Smoke Test $(date +%H%M%S)"
# `.test` é TLD reservado e às vezes rejeitado por filtros — use `.dev` por padrão.
TEST_EMAIL="${ASAAS_TEST_EMAIL:-smoke-$(date +%s)@condosync.dev}"
# Default: DDI 55 + DDD 85 + 9 dígitos. Override via ASAAS_TEST_PHONE quando precisar.
TEST_PHONE="${ASAAS_TEST_PHONE:-5585991712228}"
# Opcional. Customer não exige, mas ajuda no 3DS de cartão.
TEST_BIRTH="${ASAAS_TEST_BIRTH:-1990-05-15}"
DUE_DATE="$(date -v+5d +%Y-%m-%d 2>/dev/null || date -d '+5 days' +%Y-%m-%d)"
TEST_VALUE="123.45"
# Default UNDEFINED (Asaas Checkout deixa o pagador escolher). PIX só funciona
# se a conta sandbox já tiver uma chave Pix cadastrada — caso contrário a
# Asaas devolve "Esta cobrança não permite pagamentos via Pix.".
# Override: BILLING_TYPE=PIX ./scripts/asaas-smoke-test.sh
TEST_BILLING_TYPE="${BILLING_TYPE:-UNDEFINED}"

# ── Cores ───────────────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

ok()   { echo "${GREEN}✓${RESET} $*"; }
fail() { echo "${RED}✗${RESET} $*" >&2; exit 1; }
info() { echo "${CYAN}›${RESET} $*"; }
warn() { echo "${YELLOW}!${RESET} $*"; }

# ── Pré-checks ──────────────────────────────────────────────────────────────
echo "${BOLD}CondoSync · Asaas Sandbox Smoke Test${RESET}"
echo "──────────────────────────────────────"
info "Base URL:  $ASAAS_BASE"

command -v curl >/dev/null || fail "curl não encontrado"
command -v jq   >/dev/null || fail "jq não encontrado (brew install jq)"

if [[ -z "${ASAAS_MASTER_API_KEY:-}" ]]; then
  ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
  if [[ -f "$ENV_FILE" ]]; then
    # Chaves Asaas começam com $aact_ — sem aspas no .env o bash expande $ como variável.
    set -a
    set +u
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set -u
    set +a
  fi
fi

if [[ -z "${ASAAS_MASTER_API_KEY:-}" ]]; then
  fail "ASAAS_MASTER_API_KEY não definida (export ou backend/.env)"
fi

# Mascarar a key nos logs — só os 4 últimos caracteres aparecem.
KEY_MASKED="…${ASAAS_MASTER_API_KEY: -4}"
info "ApiKey:    $KEY_MASKED (${#ASAAS_MASTER_API_KEY} chars)"
echo

# ── Helper ──────────────────────────────────────────────────────────────────
# Importante: em caso de erro HTTP imprimimos no STDERR — porque o caller
# captura stdout via `$(asaas_call ...)`. Sem isso o `|| fail "..."` engole o
# body de erro e você fica sem diagnóstico.
asaas_call() {
  local method="$1" path="$2" body="${3:-}"
  local tmp; tmp=$(mktemp)
  local args=(-sS -o "$tmp" -w "%{http_code}" -X "$method"
              -H "access_token: $ASAAS_MASTER_API_KEY"
              -H "Content-Type: application/json"
              -H "User-Agent: condosync-smoke/1.0")
  [[ -n "$body" ]] && args+=(-d "$body")
  local code; code=$(curl "${args[@]}" "${ASAAS_BASE}${path}")
  local resp; resp=$(cat "$tmp"); rm -f "$tmp"
  if [[ "$code" -ge 400 ]]; then
    {
      echo "${RED}HTTP $code · $method $path${RESET}"
      if [[ -n "$body" ]]; then
        echo "${YELLOW}↑ request:${RESET}"
        echo "$body" | jq . 2>/dev/null || echo "$body"
      fi
      echo "${YELLOW}↓ response:${RESET}"
      echo "$resp" | jq . 2>/dev/null || echo "$resp"
    } >&2
    return 1
  fi
  echo "$resp"
}

# ── 1. GET /customers — health check ────────────────────────────────────────
info "1/4 · GET /customers?limit=1 (health check)"
if ! asaas_call GET "/customers?limit=1" >/dev/null; then
  fail "Falha no health check — apiKey provavelmente inválida ou Asaas fora do ar"
fi
ok   "Asaas respondeu, apiKey válida"
echo

# ── 2. POST /customers — cria pagador de teste ──────────────────────────────
info "2/4 · POST /customers (criando pagador de teste)"
info "    nome=$TEST_NAME  cpf=$TEST_CPF  phone=$TEST_PHONE  email=$TEST_EMAIL"
CUSTOMER_BODY=$(jq -n \
  --arg name "$TEST_NAME" \
  --arg cpf  "$TEST_CPF" \
  --arg mail "$TEST_EMAIL" \
  --arg phone "$TEST_PHONE" \
  --arg birth "$TEST_BIRTH" \
  '{name:$name, cpfCnpj:$cpf, email:$mail, mobilePhone:$phone}
   + (if $birth == "" then {} else {birthDate:$birth} end)')
CUSTOMER_RESP=$(asaas_call POST "/customers" "$CUSTOMER_BODY") || fail "Erro ao criar customer"
CUSTOMER_ID=$(echo "$CUSTOMER_RESP" | jq -r '.id // empty')
[[ -n "$CUSTOMER_ID" ]] || { echo "$CUSTOMER_RESP" | jq .; fail "Resposta sem .id"; }
ok   "Customer criado: $CUSTOMER_ID  ($(echo "$CUSTOMER_RESP" | jq -r .name))"
echo

# ── 3. POST /payments — cria cobrança Pix ───────────────────────────────────
info "3/4 · POST /payments (criando cobrança R\$ $TEST_VALUE · tipo $TEST_BILLING_TYPE)"
PAYMENT_BODY=$(jq -n \
  --arg customer "$CUSTOMER_ID" \
  --arg due "$DUE_DATE" \
  --arg value "$TEST_VALUE" \
  --arg ref "smoke-$(date +%s)" \
  --arg billing "$TEST_BILLING_TYPE" \
  '{customer:$customer, billingType:$billing, value:($value|tonumber), dueDate:$due, externalReference:$ref, description:"Smoke test CondoSync"}')
PAYMENT_RESP=$(asaas_call POST "/payments" "$PAYMENT_BODY") || fail "Erro ao criar payment"
PAYMENT_ID=$(echo "$PAYMENT_RESP" | jq -r '.id // empty')
INVOICE_URL=$(echo "$PAYMENT_RESP" | jq -r '.invoiceUrl // empty')
PAYMENT_STATUS=$(echo "$PAYMENT_RESP" | jq -r '.status // empty')
[[ -n "$PAYMENT_ID" ]] || { echo "$PAYMENT_RESP" | jq .; fail "Resposta sem .id"; }
ok   "Cobrança criada: $PAYMENT_ID (status: $PAYMENT_STATUS)"
ok   "Invoice URL:   $INVOICE_URL"
echo

# ── 4. GET /payments/:id/pixQrCode (só se billingType=PIX) ─────────────────
if [[ "$TEST_BILLING_TYPE" == "PIX" ]]; then
  info "4/4 · GET /payments/$PAYMENT_ID/pixQrCode (QR code Pix)"
  if QR_RESP=$(asaas_call GET "/payments/$PAYMENT_ID/pixQrCode"); then
    PAYLOAD=$(echo "$QR_RESP" | jq -r '.payload // empty')
    if [[ -n "$PAYLOAD" ]]; then
      PAYLOAD_PREVIEW="${PAYLOAD:0:60}…"
      ok "Pix copia-cola: $PAYLOAD_PREVIEW"
    else
      warn "Resposta veio sem .payload — verifique no painel"
    fi
  else
    warn "QR Code indisponível — a chave Pix da conta sandbox provavelmente"
    warn "não está cadastrada. Acesse https://sandbox.asaas.com → Configurações"
    warn "→ Pix → Cadastrar nova chave (use uma chave aleatória de teste)."
  fi
else
  info "4/4 · pulando QR Pix (billingType=$TEST_BILLING_TYPE — não é PIX)"
  ok   "Para testar Pix: BILLING_TYPE=PIX ./scripts/asaas-smoke-test.sh"
  ok   "Antes, cadastre uma chave Pix no painel sandbox da conta master."
fi
echo

# ── Resumo ──────────────────────────────────────────────────────────────────
echo "${GREEN}${BOLD}─────────────────────────────────${RESET}"
echo "${GREEN}${BOLD}  Sandbox 100% funcional ✓${RESET}"
echo "${GREEN}${BOLD}─────────────────────────────────${RESET}"
echo
echo "Próximos passos:"
echo "  • Abrir a invoice no navegador:  open \"$INVOICE_URL\""
echo "  • Confirmar pagamento no painel Asaas (botão 'Receber em dinheiro')"
echo "  • Quando seu backend tiver o webhook implementado, o pagamento bate ali"
echo
echo "Detalhes salvos para o próximo passo:"
echo "  CUSTOMER_ID=$CUSTOMER_ID"
echo "  PAYMENT_ID=$PAYMENT_ID"
echo
