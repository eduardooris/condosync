# CondoSync — Guia para Agentes de IA

> Documento normativo de alto nível para qualquer agente (Cursor, Claude, ChatGPT, Copilot, Aider, etc.) que vá modificar este monorepo.
>
> **Antes de tocar em código**, leia o `AGENTS.md` específico do projeto que você vai alterar:
>
> - **Backend (NestJS):** [`backend/AGENTS.md`](./backend/AGENTS.md)
> - **Frontend (React + Vite):** [`frontend/AGENTS.md`](./frontend/AGENTS.md)
> - **Message Server (Go / WhatsApp):** [`message-server-main/AGENTS.md`](./message-server-main/AGENTS.md)
> - **App mobile (Expo / React Native):** [`condosync-app/AGENTS.md`](./condosync-app/AGENTS.md)

---

## 1. Visão geral do produto

CondoSync é uma plataforma multi-tenant para gestão de condomínios: **cobranças** (Pix, lembretes, status e ações administrativas), **despesas**, **unidades** e **moradores** (incl. onboarding e telefone WhatsApp), **mural**, **ocorrências**, **enquetes**, **documentos**, **dashboard**, além de **convites** (time e moradores), **notificações in-app**, **visitantes / correspondências**, **reservas de áreas comuns**, fluxos de **cadastro / login / recuperação de senha** e um **assistente de setup** no PWA para concluir a configuração inicial do condomínio.

A arquitetura principal é composta por:

```
┌──────────────────┐     HTTPS / JWT      ┌──────────────────┐
│  frontend (PWA)  │ ───────────────────► │  backend (Nest)  │
│  React + Vite    │                      │  NestJS + TypeORM│
└──────────────────┘                      └────────┬─────────┘
        │                                        │
        │  (futuro: mesmo API contract)         │ HTTP/JSON (API key + webhook HMAC)
        ▼                                        ▼
┌──────────────────┐                    ┌────────▼─────────┐
│ condosync-app    │                    │  message-server  │
│ Expo + RN        │                    │  Go + whatsmeow  │
└──────────────────┘                    └──────────────────┘

Persistência: Postgres (schemas dedicados por serviço onde aplicável, ex.: `message_server` / `whatsmeow` no message-server)
Auth: Keycloak (realm `main`)
Filas/Cache: Redis (Bull) — filas além de cobranças/WhatsApp: ocorrências, mural, checagem de saldo, auto-fechamento de enquetes, notificações in-app
Storage: S3-compatible (MinIO em dev)
Infra local: compose modular em `infra/dev/` (incluído pelo `docker-compose.yml` na raiz); atalhos em `scripts/dev.sh`
```

O diretório **`infra/`** concentra manifests Docker de produção/IP-only, Keycloak (`infra/keycloak/realm-main.json`), Nginx e scripts de deploy/SSL — use-o ao evoluir ambiente ou SSO, não duplique config solta na raiz sem motivo.

## 2. Princípios inegociáveis (todos os projetos)

1. **Adapter Pattern em toda integração externa.** Nunca chame uma SDK / HTTP client diretamente da camada de regra de negócio. Existe um adapter (`adapters/whatsapp`, `adapters/storage`, `adapters/auth`, `adapters/payment` reservado, `internal/adapter/outbound/...` no Go) — use ou crie um.
2. **Multi-tenant por `condominium_id`.** Toda query, toda fila, todo log: leve o `condominium_id` (ou `tenant_id` no message-server). Nunca confie no que vem do `body` sem validar membership.
3. **Migrations forward-only em produção.** `synchronize: true` é apenas para dev. Toda mudança de schema vira migration versionada.
4. **Idempotência em jobs/eventos/webhooks.** Use `jobId` determinístico (Bull), `event_id` (message-server outbox/inbox), `ON CONFLICT DO NOTHING` em INSERTs de eventos.
5. **Mensagens de erro em PT-BR**, classificadas por tipo (validation/not-found/conflict/unavailable/internal). Sem `panic` / `throw new Error('foo')` cru.
6. **Logs estruturados** (Pino no Nest, `slog` no Go). Sempre com `requestId` / `correlation_id` / `event_id`. Nunca `console.log` ou `fmt.Println` em código de produção.
7. **Sem segredos em código.** Tudo vem de env, validado por schema (Zod no Nest, `internal/config` no Go) na inicialização. Falha rápido se faltar variável crítica em prod.
8. **PRs pequenos e tematicos.** Não misture refactor + feature + fix de lint. Cada projeto tem seu Makefile/`package.json` com `lint`, `test`, `build` — todos têm que passar.

## 3. Convenções compartilhadas

### Nomenclatura de domínios
Os bounded contexts do produto mapeiam para pastas em `src/modules/` (Nest) e `src/domains/` (Vite). Quando o domínio existir **nos dois** lados, use **nome em minúsculo, plural em inglês**, idêntico entre backend e frontend:

| Domínio | Backend (`src/modules/`) | Frontend (`src/domains/`) |
| --- | --- | --- |
| Autenticação / perfil | `auth/` | `auth/` |
| Cobranças | `charges/` | `charges/` |
| Despesas | `expenses/` | `expenses/` |
| Condomínios | `condominiums/` | `condominiums/` |
| Unidades | `units/` | `units/` |
| Moradores | `residents/` | `residents/` |
| Convites | `invitations/` | `invitations/` |
| Notificações (in-app) | `notifications/` | `notifications/` |
| Visitantes / correspondências | `visitors/` | `visitors/` |
| Reservas (áreas comuns) | `reservations/` | `reservations/` |
| Mural | `bulletin/` | `bulletin/` |
| Ocorrências | `occurrences/` | `occurrences/` |
| Enquetes | `polls/` | `polls/` |
| Documentos | `documents/` | `documents/` |
| Dashboard | `dashboard/` | `dashboard/` |
| Integrações (webhooks) | `integrations/` | — |
| Usuários (conta Keycloak) | `users/` | — |
| Assistente de setup (wizard) | — | `setup/` |

**Papéis de usuário** (`ADMIN`, `SUB_ADMIN`, `RESPONSIBLE`, `RESIDENT`) e a matriz de guards no API estão detalhados em [`backend/AGENTS.md`](./backend/AGENTS.md) (autenticação e multi-tenant). O PWA deve respeitar as mesmas capacidades na UX (ocultar ou desabilitar ações sem permissão).

### Status e enums
Enums compartilhados conceitualmente (status de cobrança, role de usuário, tipo de unidade) **devem** ter os mesmos valores literais no **backend** e no **frontend** (e no app mobile, quando houver tipos espelhados). O message-server tem enums próprios de transporte/domínio — alinhe nomes de eventos e payloads com o contrato do webhook, não copie enums de cobrança para Go sem necessidade. Quando adicionar um valor novo (ex.: `ChargeStatus.CANCELED`), atualize no mínimo:

- `backend/src/common/enums/index.ts`
- `frontend/src/shared/types/api.ts` (ou onde o tipo viver)
- migration TypeORM (e regenerar `frontend/openapi.json` se for usado)
- a UI que renderiza o badge / filtro

### Respostas HTTP do backend (envelope)
Toda resposta de erro segue o `ErrorResponseDto` produzido por `AllExceptionsFilter`:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Já existe um registro com esses valores.",
  "path": "/api/v1/condominiums/abc/charges",
  "timestamp": "2026-04-26T03:42:06.984Z",
  "requestId": "uuid"
}
```

O frontend assume esse envelope para extrair `message` e exibir via `react-hot-toast`. Não invente outros formatos.

### Conexão backend ↔ message-server
- Backend → message-server: `POST /v1/instances`, `/v1/instances/reconnect`, `/v1/messages/text`, `DELETE /v1/instances/:id`. Header `Authorization: Bearer <MESSAGE_SERVER_API_KEY>`.
- Message-server → backend: webhook `POST /api/v1/integrations/message-server/webhook` assinado com HMAC-SHA256 (`x-signature: sha256=...`).
- Sempre use os helpers existentes: `MessageServerAdapter` (backend) e `webhooksink.Publisher` (message-server). Não duplique a lógica de assinatura/auth.
- O message-server publica eventos via **outbox transacional** (tabela `message_server.outbox` + relay). No monorepo o modo vigente é **`TRANSPORT_MODE=http`** (webhook para o Nest). Existe modo **`TRANSPORT_MODE=kafka`** (legado / outros gateways) — detalhes em `message-server-main/AGENTS.md`.
- No backend, `IWhatsAppAdapter` tem **`MessageServerAdapter`** como implementação usada na fila de envio; existe também **`EvolutionApiAdapter`** (`EVOLUTION_*`) como variante — troca de wiring apenas com decisão explícita e revisão de env/ops.

## 4. Fluxo de trabalho recomendado para um agente

1. **Localize o código relevante** com `Grep`/`Glob`/`SemanticSearch` antes de editar. Nunca crie arquivos novos se já existir o módulo correspondente.
2. **Leia o `AGENTS.md` do projeto** que você vai mexer. Cada um tem uma seção "Como adicionar uma nova feature" com checklist concreto.
3. **Atualize o todo list** se a tarefa tiver mais de 2 etapas.
4. **Type-check / lint / build** depois de editar:
   - Backend: `cd backend && npx tsc --noEmit && npm run lint`
   - Frontend: `cd frontend && npm run lint && npm run build`
   - Message-server: `cd message-server-main && make fmt vet test`
   - App mobile: `cd condosync-app && npx tsc --noEmit` (e `npm run start` / Expo conforme a tarefa)
5. **Suba o stack via Docker Compose** quando precisar validar end-to-end. O `docker-compose.yml` na raiz **inclui** os composes modulares em `infra/dev/`; atalhos: `./scripts/dev.sh up|deps|api|msg|down`. Exemplos:
   ```bash
   docker compose build api && docker compose up -d api
   docker logs condosync-api --tail=50
   docker compose build message-server && docker compose up -d message-server
   docker logs condosync-message-server --tail=80
   ```
6. **Não faça commits automaticamente.** Aguarde instrução explícita do usuário.

## 5. Documentação do produto

Para entender as regras de negócio (RN-XX), histórias de usuário (US-XX) e o blueprint geral, consulte:

- `docs/01_regras_historias_usuario.md` — RN/US numeradas, fonte de verdade do produto.
- `docs/02_backend_guia_tecnico.md` — guia técnico detalhado (longo, escrito antes do código existir).
- `docs/03_frontend_guia_tecnico.md` — idem para o frontend.
- `docs/04_condominium_manager_system_blueprint.md` — visão de sistema.

> Quando houver conflito entre os `*_guia_tecnico.md` e o `AGENTS.md` de cada projeto, **o `AGENTS.md` ganha** — ele reflete o código real em produção. Os guias técnicos são históricos.

## 6. Quando estiver em dúvida

- Pergunte ao usuário antes de inventar uma decisão arquitetural (ex.: trocar provider, criar nova fila, mudar contrato HTTP).
- Use o estilo de código que **já existe no arquivo vizinho**, não o que você acha melhor.
- Em PT-BR para mensagens, comentários, logs visíveis ao usuário. Em inglês para nomes de variáveis/funções/tipos.
