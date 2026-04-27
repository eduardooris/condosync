# CondoSync Condominium Manager - Full System Blueprint

This document consolidates business requirements, frontend architecture guidance, and live API contracts into one implementation-oriented source of truth for CondoSync as a production-grade condominium management platform.

## 1) Source of Truth Used

- Business and user stories: `01_regras_historias_usuario.md`
- Frontend technical architecture guide: `03_frontend_guia_tecnico.md`
- Live API contract analyzed at runtime: `http://localhost:3000/api/openapi.json`
- Current backend bootstrap and module composition: `backend/src/main.ts`, `backend/src/app.module.ts`
- Frontend routing/API integration baseline: `frontend/src/app/router.tsx`, `frontend/src/shared/lib/axios.ts`
- Environment and infrastructure references:
  - `backend/src/config/env.schema.ts`
  - `backend/.env.example`
  - `frontend/.env.example`
  - `infra/.env.prod.example`
  - `docker-compose.yml`
  - `infra/README.md`

---

## 2) Product Mission and Core Personas

CondoSync must operate as a lightweight but auditable digital administration layer for condominiums (especially cost-sensitive subsidized developments), replacing ad-hoc paper and chat-based management with structured workflows, financial transparency, and role-based governance.

### Primary personas

- **Syndic (ADMIN):** full management power over condominium setup, finance, documents, communication, polls, and incidents.
- **Sub-syndic (SUB_ADMIN / configurable assistant):** delegated management permissions (module-level or role-level subset).
- **Financial Responsible Resident:** pays dues, receives billing notifications, and can vote where unit-level voting is required.
- **Resident (RESIDENT):** consumes notices/documents/financial transparency and can open incidents.

### Multi-tenancy model

- One user can belong to multiple condominiums.
- Every domain operation is scoped by `condominiumId`.
- Frontend must always carry an active condominium context.
- Backend must enforce membership-based access for all tenant-bound routes.

---

## 3) Mandatory Business Rules to Preserve

The platform must preserve and enforce the following rules in backend logic, UI behavior, and data model:

### RN-01 Condominium and Unit structure

- A user may administer multiple condominiums (N:N relation).
- Each unit belongs to exactly one condominium.
- A condominium cannot be physically deleted when active units/financial obligations exist; archival must be used.
- Archive/unarchive lifecycle must be explicit and auditable.

### RN-02 Residents and financial responsibility

- Exactly one active financial responsible per unit.
- Financial responsible must have valid CPF + WhatsApp format.
- Switching responsible must preserve history and revoke previous financial privileges.
- A resident may be linked to multiple units but can only be financial responsible for one unit at a time.

### RN-03 Financial governance

- Monthly charges generated automatically according to configured due day.
- Charge lifecycle: `pending -> paid | overdue | exempt`.
- Exemption requires mandatory reason.
- Expenses require category and should optionally include supporting document.
- Balance = paid collections minus approved expenses.
- Overdue escalation and reminder notifications must be automated after grace period.

### RN-04 Poll governance

- One vote per unit, only by financial responsible.
- Vote must be irreversible.
- Poll result visibility must remain locked until closure.
- Poll closes by date or manual admin action.
- Quorum target should be configurable per poll.

### RN-05 Occurrence workflow

- Status lifecycle: `open -> under_review -> resolved | archived` (terminology can vary but states must map).
- Residents can open with optional anonymity for peers.
- Syndic/admin controls status transitions.
- Status transitions trigger notifications.

---

## 4) Current API Contract Baseline (Live OpenAPI)

### API metadata

- Title: `CondoSync API`
- Version: `local`
- Base prefix: `/api/v1`
- Security scheme: bearer JWT (`components.securitySchemes.bearer`)
- Total path templates: `44`
- Total schemas: `51`

### Authentication and session endpoints

- `POST /api/v1/auth/login` -> body `LoginDto`, response `LoginResponseDto`
- `POST /api/v1/auth/logout` -> header `authorization`, response `OkResponseDto`
- `GET /api/v1/auth/me` -> response `MeResponseDto`

### Health endpoint

- `GET /api/v1/health` -> response `HealthResponseDto`

### Condominium management endpoints

- `POST /api/v1/condominiums` -> `CreateCondominiumDto` -> `CondominiumResponseDto`
- `GET /api/v1/condominiums/mine` -> `CondominiumResponseDto[]`
- `GET /api/v1/condominiums/{condominiumId}` -> `CondominiumResponseDto`
- `PATCH /api/v1/condominiums/{condominiumId}` -> `UpdateCondominiumDto` -> `CondominiumResponseDto`
- `DELETE /api/v1/condominiums/{condominiumId}` -> archive operation -> `CondominiumResponseDto`
- `POST /api/v1/condominiums/{condominiumId}/unarchive` -> `CondominiumResponseDto`
- `POST /api/v1/condominiums/{condominiumId}/members` -> `AddMemberDto` -> `MembershipResponseDto`

### Units and residents endpoints

- `GET /api/v1/condominiums/{condominiumId}/units` -> `UnitResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/units` -> `CreateUnitDto` -> `UnitResponseDto`
- `POST /api/v1/condominiums/{condominiumId}/units/import` -> `ImportUnitsDto` -> `ImportUnitsResponseDto`
- `PATCH /api/v1/condominiums/{condominiumId}/units/{unitId}` -> `UpdateUnitDto` -> `UnitResponseDto`
- `GET /api/v1/condominiums/{condominiumId}/units/{unitId}/residents` -> `ResidentResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/units/{unitId}/residents` -> `CreateResidentDto` -> `ResidentResponseDto`
- `PATCH /api/v1/condominiums/{condominiumId}/units/{unitId}/residents/{id}` -> `UpdateResidentDto` -> `ResidentResponseDto`
- `POST /api/v1/condominiums/{condominiumId}/units/{unitId}/residents/{id}/set-responsible` -> `ResidentResponseDto`
- `GET /api/v1/condominiums/{condominiumId}/neighbors` -> `NeighborResidentResponseDto[]`

### Charges endpoints

- `GET /api/v1/condominiums/{condominiumId}/charges` -> `ChargeResponseDto[]`
- `GET /api/v1/condominiums/{condominiumId}/charges/mine` -> `ChargeResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/charges` -> `CreateChargeDto` -> `ChargeResponseDto`
- `POST /api/v1/condominiums/{condominiumId}/charges/generate` -> `GenerateMonthDto` -> `GenerateMonthResponseDto`
- `PATCH /api/v1/condominiums/{condominiumId}/charges/{chargeId}` -> `UpdateChargeDto` -> `ChargeResponseDto`
- `PATCH /api/v1/charges/{id}/mark-paid` -> `MarkPaidDto` -> `ChargeResponseDto`
- `PATCH /api/v1/charges/{id}/exempt` -> `ExemptChargeDto` -> `ChargeResponseDto`

### Expenses endpoints

- `GET /api/v1/condominiums/{condominiumId}/expenses` -> `ExpenseResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/expenses` -> multipart/form-data upload flow -> `ExpenseResponseDto`
- `PATCH /api/v1/condominiums/{condominiumId}/expenses/{id}` -> `UpdateExpenseDto` -> `ExpenseResponseDto`
- `DELETE /api/v1/condominiums/{condominiumId}/expenses/{id}` -> `OkResponseDto`
- `GET /api/v1/condominiums/{condominiumId}/expenses/summary` with `from`/`to` query -> `ExpenseSummaryRowDto[]`

### Bulletin endpoints

- `GET /api/v1/condominiums/{condominiumId}/bulletin` (+ `includeExpired` query) -> `BulletinResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/bulletin` -> `CreateBulletinDto` -> `BulletinResponseDto`

### Documents endpoints

- `GET /api/v1/condominiums/{condominiumId}/documents` -> `DocumentResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/documents` -> upload flow -> `DocumentResponseDto`
- `DELETE /api/v1/condominiums/{condominiumId}/documents/{id}` -> `OkResponseDto`
- `GET /api/v1/condominiums/{condominiumId}/documents/{id}/url` -> `SignedUrlResponseDto`
- `GET /api/v1/documents/{id}/url` -> `SignedUrlResponseDto`

### Occurrences endpoints

- `GET /api/v1/condominiums/{condominiumId}/occurrences` -> `OccurrenceResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/occurrences` -> object body (with optional attachment) -> `OccurrenceResponseDto`
- `PATCH /api/v1/condominiums/{condominiumId}/occurrences/{id}/status` -> `UpdateOccurrenceStatusDto` -> `OccurrenceResponseDto`
- `GET /api/v1/condominiums/{condominiumId}/occurrences/{id}/attachment-url` -> `SignedUrlResponseDto`

### Poll endpoints

- `GET /api/v1/condominiums/{condominiumId}/polls` -> `PollResponseDto[]`
- `POST /api/v1/condominiums/{condominiumId}/polls` -> `CreatePollDto` -> `PollResponseDto`
- `GET /api/v1/condominiums/{condominiumId}/polls/{pollId}` -> `PollResponseDto`
- `POST /api/v1/condominiums/{condominiumId}/polls/{pollId}/close` -> `PollResponseDto`
- `GET /api/v1/condominiums/{condominiumId}/polls/{pollId}/results` -> `PollResultsResponseDto`
- `POST /api/v1/polls/{id}/vote` -> `VotePollDto` -> `PollVoteResponseDto`

### Notification endpoints

- `GET /api/v1/me/notifications` (optional `unread` query) -> `NotificationResponseDto[]`
- `GET /api/v1/me/notifications/unread-count` -> `UnreadCountResponseDto`
- `PATCH /api/v1/me/notifications/{id}/read` -> `NotificationResponseDto`
- `POST /api/v1/me/notifications/read-all` -> `UpdatedCountResponseDto`

### Shared error model

- Most protected endpoints include standardized error responses by code:
  - `400` validation/business input errors
  - `401` authentication failures
  - `403` authorization failures
  - `404` not found
  - `409` conflict
  - `422` unprocessable domain rule failures
  - `500` internal errors

---

## 5) Backend Implementation Surfaces (Where to Modify)

### Application bootstrap and global concerns

- `backend/src/main.ts`
  - global API prefix
  - global validation and exception filter
  - OpenAPI generation and tags
  - CORS policy
  - helmet/compression hardening
- `backend/src/app.module.ts`
  - module registration
  - logger setup
  - TypeORM config
  - Bull queue config
  - global throttling guard

### Domain controllers and services

- Auth: `backend/src/modules/auth/auth.controller.ts`, `backend/src/modules/auth/auth.service.ts`
- Condominiums: `backend/src/modules/condominiums/condominiums.controller.ts`, `backend/src/modules/condominiums/condominiums.service.ts`
- Units: `backend/src/modules/units/units.controller.ts`, `backend/src/modules/units/units.service.ts`
- Residents: `backend/src/modules/residents/residents.controller.ts`, `backend/src/modules/residents/residents.service.ts`
- Charges:
  - `backend/src/modules/charges/charges.controller.ts`
  - `backend/src/modules/charges/charge-actions.controller.ts`
  - `backend/src/modules/charges/charges.service.ts`
- Expenses: `backend/src/modules/expenses/expenses.controller.ts`, `backend/src/modules/expenses/expenses.service.ts`
- Documents: `backend/src/modules/documents/documents.controller.ts`, `backend/src/modules/documents/documents.service.ts`
- Polls: `backend/src/modules/polls/polls.controller.ts`, `backend/src/modules/polls/polls.service.ts`
- Occurrences: `backend/src/modules/occurrences/occurrences.controller.ts`, `backend/src/modules/occurrences/occurrences.service.ts`
- Bulletin: `backend/src/modules/bulletin/bulletin.controller.ts`, `backend/src/modules/bulletin/bulletin.service.ts`
- Dashboard: `backend/src/modules/dashboard/dashboard.controller.ts`, `backend/src/modules/dashboard/dashboard.service.ts`
- Notifications: `backend/src/modules/notifications/notifications.controller.ts`, `backend/src/modules/notifications/notifications.service.ts`

### Cross-cutting adapters and async integrations

- Auth adapters:
  - `backend/src/adapters/auth/auth.adapter.ts`
  - `backend/src/adapters/auth/keycloak-auth.adapter.ts`
- Storage adapters:
  - `backend/src/adapters/storage/storage.adapter.ts`
  - `backend/src/adapters/storage/s3-storage.adapter.ts`
- WhatsApp adapter:
  - `backend/src/adapters/whatsapp/whatsapp.adapter.ts`
  - `backend/src/adapters/whatsapp/evolution-api.adapter.ts`
- Payment adapter (placeholder/integration point):
  - `backend/src/adapters/payment/payment.adapter.ts`
- Queue processing:
  - `backend/src/queues/queues.module.ts`
  - `backend/src/queues/queue-names.ts`
  - `backend/src/queues/whatsapp.processor.ts`

### Data model and migrations

- Entities live in `backend/src/database/entities`
- Current entities include:
  - `user.entity.ts`
  - `user-condominium.entity.ts`
  - `condominium.entity.ts`
  - `unit.entity.ts`
  - `resident.entity.ts`
  - `financial-responsible-history.entity.ts`
  - `charge.entity.ts`
  - `expense.entity.ts`
  - `poll.entity.ts`
  - `poll-option.entity.ts`
  - `poll-vote.entity.ts`
  - `occurrence.entity.ts`
  - `bulletin-post.entity.ts`
  - `document.entity.ts`
  - `notification.entity.ts`
- Migration location: `backend/src/database/migrations`

---

## 6) Frontend Implementation Surfaces (Where to Modify)

### App shell, routing, and providers

- Router and route guards: `frontend/src/app/router.tsx`, `frontend/src/app/ProtectedRoute.tsx`
- App providers: `frontend/src/app/providers.tsx`
- Layout components:
  - `frontend/src/shared/components/layout/ProtectedLayout.tsx`
  - `frontend/src/shared/components/layout/Header.tsx`
  - `frontend/src/shared/components/layout/Sidebar.tsx`
  - `frontend/src/shared/components/layout/CondoSwitcher.tsx`
  - `frontend/src/shared/components/layout/MobileQuickNav.tsx`
  - `frontend/src/shared/components/layout/CommandPalette.tsx`

### API client and generated types

- Axios base client + auth interceptor: `frontend/src/shared/lib/axios.ts`
- React Query setup: `frontend/src/shared/lib/queryClient.ts`
- OpenAPI-generated contract types: `frontend/src/shared/types/openapi.generated.ts`
- Local API helper types: `frontend/src/shared/types/api.ts`

### Global state

- Auth and active condominium state: `frontend/src/shared/stores/auth.store.ts`
- UI state (theme/sidebar): `frontend/src/shared/stores/ui.store.ts`

### Domain pages/services/hooks currently in use

- Setup flow:
  - `frontend/src/domains/setup/pages/SetupPage.tsx`
  - `frontend/src/domains/setup/components/*`
  - `frontend/src/domains/setup/store/setup.store.ts`
- Condominiums:
  - pages/components/services under `frontend/src/domains/condominiums`
- Units:
  - `frontend/src/domains/units/pages/UnitsPage.tsx`
  - `frontend/src/domains/units/services/units.service.ts`
- Residents:
  - `frontend/src/domains/residents/pages/ResidentsPage.tsx`
  - `frontend/src/domains/residents/services/residents.service.ts`
  - `frontend/src/domains/residents/schemas/resident.schema.ts`
- Charges:
  - `frontend/src/domains/charges/pages/ChargesPage.tsx`
  - `frontend/src/domains/charges/services/charges.service.ts`
  - `frontend/src/domains/charges/hooks/useCharges.ts`
- Expenses:
  - `frontend/src/domains/expenses/pages/ExpensesPage.tsx`
  - `frontend/src/domains/expenses/services/expenses.service.ts`
  - `frontend/src/domains/expenses/hooks/useExpenses.ts`
- Dashboard:
  - `frontend/src/domains/dashboard/pages/DashboardPage.tsx`
  - `frontend/src/domains/dashboard/services/dashboard.service.ts`
  - `frontend/src/domains/dashboard/hooks/useDashboard.ts`
  - `frontend/src/domains/dashboard/components/*`
- Bulletin/Documents/Occurrences/Polls:
  - each has `pages` + `services` under `frontend/src/domains/{module}`
- Auth:
  - `frontend/src/domains/auth/pages/LoginPage.tsx`
  - `frontend/src/domains/auth/pages/SettingsPage.tsx`
  - `frontend/src/domains/auth/services/auth.service.ts`
  - `frontend/src/domains/auth/schemas/login.schema.ts`

### Shared UI primitives and design system

- `frontend/src/shared/components/ui/*` (Button, Input, Select, Dialog, Badge, KpiCard, GlassCard, etc.)
- Styling conventions from guide: Tailwind + motion transitions + dark-first UI

---

## 7) Functional Requirements by Module (Must-Have)

### A) Identity, access, tenancy

The system must:

- support authenticated sessions with bearer tokens.
- resolve current user profile and condominium memberships.
- enforce role-based permissions across routes and API operations.
- allow fast switching among condominiums for users in multiple memberships.

Critical files:

- Backend: auth + condominiums modules, membership logic, guards/policies.
- Frontend: `auth.store.ts`, `ProtectedRoute`, `CondoSwitcher`, route-level role enforcement.

### B) Condominium setup and administration

The system must:

- create condominium records with legal and financial baseline data.
- maintain archive/unarchive lifecycle instead of hard delete.
- support delegated administration (member add/update).

Critical files:

- Backend: condominiums controller/service.
- Frontend: condominium pages + settings sections + memberships service.

### C) Unit registry

The system must:

- support unit creation/edit/update and CSV batch import.
- store occupancy state and type metadata.
- provide admin listing and filters by block/number/status.

Critical files:

- Backend: units module.
- Frontend: units page and service.

### D) Resident and financial responsible management

The system must:

- register multiple residents per unit.
- guarantee exactly one financial responsible per unit.
- validate CPF/WhatsApp input constraints.
- preserve historical transitions of financial responsible assignment.

Critical files:

- Backend: residents module + history entity.
- Frontend: residents page/service/schema.

### E) Charges and collection operations

The system must:

- generate monthly charges in bulk.
- allow manual charge creation/edition.
- support status transitions (`pending`, `paid`, `overdue`, `exempt`).
- require exemption reason and payment metadata.
- expose resident-specific charge listing (`/charges/mine`).

Critical files:

- Backend: charges module (including charge action endpoints).
- Frontend: charges page/hook/service.

### F) Expense ledger and financial transparency

The system must:

- allow expense registration with category and optional attachment.
- maintain expense update/remove operations for admin.
- expose summary by period and category.
- feed dashboard indicators and monthly chart series.

Critical files:

- Backend: expenses + dashboard modules.
- Frontend: expenses + dashboard domains and chart components.

### G) Bulletin and communication

The system must:

- publish notices with priority and expiration behavior.
- support resident read visibility and optional filtering of expired items.
- integrate urgent communication channels (in-app + WhatsApp adapter path).

Critical files:

- Backend: bulletin + notifications + whatsapp queue/adapter.
- Frontend: bulletin page + notification UI.

### H) Documents and signed URL access

The system must:

- upload and store condominium documents with metadata.
- authorize access by condominium membership.
- generate temporary signed URLs for controlled download.

Critical files:

- Backend: documents module + storage adapter.
- Frontend: documents page + documents service.

### I) Occurrence management

The system must:

- let residents open occurrences with optional attachments.
- allow status progression by authorized manager role.
- notify involved users when status changes.

Critical files:

- Backend: occurrences module + notifications.
- Frontend: occurrences page/service.

### J) Polling and governance voting

The system must:

- create polls with options and close windows.
- allow single irreversible vote by authorized unit representative.
- hide result details before closure.
- provide results endpoint after closure.

Critical files:

- Backend: polls module + vote endpoint.
- Frontend: polls page/service and vote UI.

### K) Personal notifications

The system must:

- provide read/unread inbox.
- expose unread count for header badges.
- support single and bulk mark-as-read actions.

Critical files:

- Backend: notifications module.
- Frontend: header + notification center integration.

---

## 8) Operational Requirements (System Must Run Reliably)

### Environment variables (backend)

Mandatory baseline:

- `DATABASE_URL`
- `AUTH_PROVIDER` (sempre `keycloak`)
- `PORT`
- `CORS_ORIGINS`
- `REDIS_URL`
- `STORAGE_PROVIDER` (sempre `s3`), `STORAGE_BUCKET`

Conditional requirements:

- Auth (`AUTH_PROVIDER=keycloak`): `KEYCLOAK_ISSUER`, `KEYCLOAK_CLIENT_ID` (and typically base URL/realm/secret)
- Storage (`STORAGE_PROVIDER=s3`): `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; opcionalmente `S3_ENDPOINT`/`S3_PUBLIC_ENDPOINT` (MinIO/R2) e `S3_FORCE_PATH_STYLE`

Optional but production-relevant:

- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `EVOLUTION_TIMEOUT_MS`
- `THROTTLE_LIMIT`, `THROTTLE_TTL`, `THROTTLE_AUTH_LIMIT`
- `LOG_LEVEL`
- `IMAGE_TAG`

### Environment variables (frontend)

- `VITE_API_BASE_URL` (without `/api/v1`, because frontend appends prefix)
- `VITE_KEYCLOAK_URL`
- `VITE_KEYCLOAK_REALM`
- `VITE_KEYCLOAK_CLIENT_ID`

### Infrastructure baseline

Development compose stack (`docker-compose.yml`) includes:

- `api` (NestJS)
- `postgres` (application DB)
- `redis` (queues/cache)
- `keycloak` + `keycloak-db`

Production stack (infra folder) expects:

- `docker-compose.prod.yml` + `docker-compose.api.yml`
- nginx edge routing
- isolated API deploy from GHCR
- healthcheck-gated rollout with rollback (`infra/scripts/deploy-api.sh`)

---

## 9) Security, Governance, and Reliability Requirements

The platform must implement and preserve:

- JWT bearer auth on all non-public routes.
- role-based authorization with clear admin/sub-admin/resident boundaries.
- strict DTO validation with whitelist/forbidNonWhitelisted behavior.
- CORS restrictions in production (no empty list).
- request throttling globally and stricter limits on auth routes.
- consistent error model for frontend predictability.
- attachment/document access through signed URLs (no public bucket leakage).
- central request id propagation/logging for supportability.

---

## 10) Traceability Matrix (Business Rule -> API -> Code Surface)

### RN-01 (Condominium lifecycle and archival)

- API: `/condominiums`, `/condominiums/{id}`, `/condominiums/{id}/unarchive`, `/condominiums/{id}/members`
- Backend: condominiums module + membership entity (`user-condominium.entity.ts`)
- Frontend: condominiums pages/sections/services

### RN-02 (Financial responsible constraints)

- API: `/units/{unitId}/residents`, `/residents/{id}/set-responsible`
- Backend: residents module + `financial-responsible-history.entity.ts`
- Frontend: residents forms and validation schema

### RN-03 (Charge and expense transparency)

- API: charges endpoints, expenses endpoints, dashboard endpoints
- Backend: charges/expenses/dashboard modules + scheduled/queued jobs
- Frontend: charges/expenses/dashboard pages and hooks

### RN-04 (Poll vote governance)

- API: polls CRUD + close + results + vote endpoint
- Backend: polls module/entities (`poll`, `poll-option`, `poll-vote`)
- Frontend: polls page and irreversible vote UX

### RN-05 (Occurrences and communication)

- API: occurrences list/create/status/update + attachment URL
- Backend: occurrences + notifications + whatsapp adapter path
- Frontend: occurrences page and notification surfacing

---

## 11) Implementation Priorities to Reach Full Condominium Manager Capability

1. **Tenancy and role-hardening first**
   - ensure every protected API route enforces membership + role.
   - enforce route-level parity in frontend guards.
2. **Financial backbone second**
   - complete charge automation + overdue progression + expense transparency.
   - guarantee dashboard numbers are directly derived from ledger truth.
3. **Governance and communication third**
   - poll integrity (single vote/unit, result lock until closure).
   - incidents + bulletin + notification fanout.
4. **Document and evidence chain**
   - signed URL downloads and metadata/audit discipline.
5. **Operational resilience**
   - queue reliability, retries, observability, healthcheck + rollback workflows.

---

## 12) Potential Gaps to Validate Against Product Intent

The following items are in business/technical guidance and should be explicitly verified in code or API behavior before declaring production completeness:

- configurable quorum rules on polls and visibility policies per poll.
- guaranteed automated reminder trigger exactly after defined overdue window.
- full WhatsApp notification coverage across billing, bulletin urgency, and occurrence status transitions.
- delegated permission matrix for sub-syndic beyond simple role checks.
- explicit financial report export requirements (for example PDF) if needed by operations.
- strong audit trail for critical actions (responsible changes, exemptions, archival decisions).

These checks should be performed primarily in:

- backend services/controllers of `charges`, `polls`, `occurrences`, `notifications`, `condominiums`, `residents`
- frontend pages of `charges`, `polls`, `occurrences`, `dashboard`, `settings`, `condominiums`

---

## 13) Quick Execution Checklist (Engineering Teams)

Backend checklist:

- validate `env.schema.ts` constraints in every environment.
- keep OpenAPI contract synchronized and regenerate frontend types.
- verify all tenant-bound endpoints reject unauthorized membership access.
- ensure queues/adapters fail safely (retry + dead-letter strategy if needed).

Frontend checklist:

- all API calls use `shared/lib/axios.ts` base and token interceptor.
- all protected routes are wrapped by role-aware `ProtectedRoute`.
- all forms use schema validation (Zod + RHF) before submission.
- all domain pages consume typed service responses from generated contracts.

DevOps checklist:

- protect production secrets in `.env.prod` only.
- deploy API via GHCR + healthcheck-gated script, avoid in-place mutable server builds.
- monitor health endpoint and structured logs continuously.

---

## 14) Final Definition of "System Works as Condominium Manager"

CondoSync is functionally complete as a condominium manager when all of the following are simultaneously true:

- multi-condominium tenancy and role governance are enforced end-to-end.
- all core modules (units, residents, charges, expenses, dashboard, polls, occurrences, bulletin, documents, notifications) are operational with consistent contracts.
- financial operations are auditable, transparent to residents, and automatable for admins.
- governance actions (voting, incident status changes, archival) are traceable and permissioned.
- communication flows (in-app + optional WhatsApp) are reliable and linked to business events.
- infrastructure supports secure, repeatable deployments with healthchecks and rollback.

At this point, the platform can be considered a production-ready digital condominium administration system rather than only a CRUD application.

