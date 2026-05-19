# CondoSync · Back-office (`admin/`)

Painel interno de operação, separado do app dos usuários (`frontend/`).
Acesso restrito por realm role `master-admin` no Keycloak.

## Setup local

```bash
cd admin
cp .env.example .env.local      # ajuste se backend/Keycloak não estão em localhost
npm install
npm run dev                      # sobe em http://localhost:5174
```

## Pré-requisitos no Keycloak

O `admin/` usa **password grant** (Direct Access Grants) com tela de login
própria — reusa o mesmo client `main-frontend` do app principal. Sem
configuração de redirect URIs, sem PKCE.

### 1. Cria a realm role `master-admin`

Console `http://localhost:8080` → admin login → Realm `main` →
**Realm roles** → **Create role** → nome: `master-admin`.

### 2. Atribui a role ao seu usuário

**Users** → seu usuário → aba **Role mapping** → **Assign role** → marca
`master-admin` → Assign.

Se você já estiver logado no admin, faça logout/login pra o novo access_token
trazer a role.

A role é validada pelo backend (`MasterRoleGuard`) e pelo front (no AuthContext) —
backend é fonte de verdade.

Rotas `/payment-account/dev/*` (force-active, secrets, simular Pix, etc.) aceitam
token de **síndico ADMIN** do condomínio **ou** `master-admin` do back-office.
Na VPS com sandbox: `ASAAS_ALLOW_SANDBOX_IN_PROD=true` (senão os endpoints dev
retornam 403 mesmo com Asaas sandbox).

## Telas atuais

| Rota | O que faz |
| --- | --- |
| `/` | Visão geral (KPIs de subcontas + webhooks) |
| `/pagamentos` | Lista todas as subcontas Asaas dos condomínios |
| `/pagamentos/:id` | Detalhe + ações (refresh webhook, force-active, simular Pix em cobrança) |
| `/cobrancas` | Lista cross-tenant com filtros — busca por pay_id, descrição, etc. |
| `/webhooks` | Eventos recebidos com filtro (falhas/processados) + reprocess |

## Stack

- Vite + React 19 + TypeScript
- Tailwind (paleta zinc/stone, dark-first, sem glass)
- TanStack Query + Table
- `react-oidc-context` pra Auth Code + PKCE
- Radix primitivos (Dialog, Dropdown, Tabs)

## Deploy

Em prod, sugerido:
- Subdomínio: `admin.condosync.duckdns.org`
- Cliente Keycloak próprio: `admin-frontend` com redirect URIs
  `https://admin.condosync.duckdns.org/*`
- Nginx server block com IP allowlist opcional pra travar acesso

Hoje **NÃO está integrado no compose de prod** — adicionar quando estabilizar.
