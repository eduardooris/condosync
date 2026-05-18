**CondoSync**

Pagamentos & Integração Asaas — Cobrança automatizada com subcontas, split e webhook

Documento 6 · v1.0 (especificação)

Complementa: [`01_regras_historias_usuario.md`](./01_regras_historias_usuario.md) · Substitui RN-03 (financeiro) parte de "Pix manual" pelo novo gateway · Implementação em fases conforme [`AGENTS.md`](../AGENTS.md)

---

# 1. Visão geral

## 1.1 Problema

O CondoSync hoje gera cobranças locais e envia avisos por WhatsApp com a **chave Pix manual do condomínio**. Isso traz quatro dores reais:

- Síndico precisa **conciliar à mão** (olhar extrato bancário, marcar pago no app). Erro humano + atraso.
- Morador paga em qualquer Pix; **sem rastreabilidade** real do recebimento.
- Não há **boleto, cartão, parcelamento** — só Pix. Inadimplente sem segunda opção.
- Síndico que troca de banco precisa atualizar a chave Pix manualmente em todos os comunicados antigos.

## 1.2 Solução

Integrar com a **Asaas** (gateway de pagamentos brasileiro com BaaS/subcontas) para:

- Cada condomínio tem uma **subconta Asaas** vinculada ao síndico (PF ou PJ).
- Cobranças geradas no CondoSync são **emitidas como `Payment` na Asaas** para o **CPF do responsável financeiro da unidade**.
- O pagador escolhe **Pix, boleto ou cartão** (à vista ou parcelado).
- A Asaas notifica o CondoSync via **webhook** quando confirma pagamento → status local atualiza automaticamente (RN-03.2 reaproveitada).
- Dinheiro cai direto na conta do síndico (não passa pela SaaS).

## 1.3 Decisões de produto (fixas)

| Tema | Decisão | Justificativa |
| --- | --- | --- |
| Tipo de subconta | **Standard** (não White Label) | Síndico precisa ver extrato/saldo/saque no painel Asaas — replicar isso no CondoSync é fora de escopo |
| Conta recebedora | Subconta Asaas **do condomínio** (1 por condo, sob o `cpfCnpj` do síndico) | Multi-tenant nativo; cada condo é uma "empresa" pra Asaas |
| Receita SaaS | **Sem split de plataforma na v1** — cobrar mensalidade B2B do síndico por fora | Reduz fricção no onboarding; split fica pré-cabeado para ativar quando o pricing estiver definido |
| Quem é o "customer" Asaas | **Responsável financeiro da unidade** (CPF obrigatório) | Cobrança nominal ao pagador; cumpre LGPD/RN-02 |
| Tipos de pagamento aceitos | `PIX`, `BOLETO`, `CREDIT_CARD`, `UNDEFINED` (pagador escolhe) | Padrão Asaas; reduz inadimplência |
| Cobrança em unidade vaga | **Gerada normalmente** — proprietário continua devendo (ver doc 01 RN-03.6 atualizada) | Já fix aplicado no `generateMonth` |
| Pré-requisito de geração | **100% das unidades não isentas precisam ter responsável financeiro** | Sem CPF do pagador, Asaas recusa a cobrança |
| Fallback se subconta `PENDING` | **Bloquear emissão** e mostrar banner ao síndico | Não criar cobrança "fantasma" sem destino |
| Bounded context | Novo módulo `payments/` no backend (adapter `AsaasService`) | Mantém `charges` neutro do gateway — futura troca de provedor não exige rewrite |
| Webhook | Endpoint único `/integrations/asaas/webhook` com auth por header `asaas-access-token` (segredo por subconta) | Recomendação oficial Asaas |

## 1.4 Glossário

| Termo | Definição |
| --- | --- |
| Asaas | Gateway de pagamentos brasileiro com PIX/boleto/cartão e subcontas |
| Subconta (conta filha) | Conta Asaas vinculada à conta master da SaaS, identificada por `walletId` e `apiKey` próprios |
| `walletId` | UUID público da subconta — usado para split entre contas Asaas |
| `apiKey` | Token secreto da subconta — usado para autenticar requests HTTP em nome dela |
| `Payment` | Cobrança na Asaas (a "charge" do nosso domínio) |
| `Customer` | Pagador na Asaas (no nosso domínio, o responsável financeiro) |
| KYC | Verificação de identidade (Know Your Customer) — Asaas exige docs |
| Onboarding | Fluxo de aprovação da subconta: dados + docs + chave bancária |
| Split | Repasse automático entre subcontas Asaas (% ou valor fixo) |
| MEI/PJ/PF | Pessoa Física, MEI, Pessoa Jurídica (LTDA, SA) — tipos aceitos pela Asaas |

---

# 2. Arquitetura de integração

## 2.1 Fluxo macro

```
┌─────────────────┐                                    ┌─────────────────┐
│  Síndico cria   │                                    │ Morador (resp.  │
│  conta no       │                                    │ financeiro) abre│
│  CondoSync      │                                    │ link Pix/QR     │
└────────┬────────┘                                    └────────┬────────┘
         │                                                       │
         │ POST /accounts                                        │ GET payment URL
         ▼                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            ASAAS (Banco)                                 │
│  Conta Master CondoSync                                                  │
│   └── Subconta Condomínio "X" (PF do síndico, walletId=W1, apiKey=K1)    │
│         └── Customer "João Silva" (CPF do resp. financeiro da unidade)   │
│               └── Payment R$ 850,00 PIX (dueDate 10/06)                  │
│                     │                                                    │
│                     └─── (pagamento)  ────► Saldo na Subconta            │
└─────────────────────────────────────────────────────────────────────────┘
         │                                                       │
         │ webhook PAYMENT_RECEIVED                              │
         ▼                                                       │
┌─────────────────┐                                              │
│  CondoSync API  │ ──► UPDATE charges SET status='PAID' ────────┘
│  /integrations  │ ──► UPDATE notifications (CHARGE_PAID p/ síndico + morador)
│  /asaas/webhook │ ──► UPDATE dashboard (saldo do condo)
└─────────────────┘
```

## 2.2 Decisão técnica: Standard vs White Label

A Asaas oferece dois tipos de subconta:

| | Standard | White Label |
| --- | --- | --- |
| Painel Asaas para o usuário | ✅ Síndico acessa | ❌ Acesso via SaaS |
| Saque/transferência | Síndico operacionaliza | SaaS precisa expor |
| KYC | Fluxo Asaas (link) | SaaS hospeda |
| Tempo de implementação | Baixo | Alto |
| Quem é "rosto" da operação | Asaas | SaaS |

**Escolha: Standard.** Justificativa:

- Operações financeiras complexas (estorno, antecipação, saque, conciliação) **ficam na responsabilidade do síndico no painel Asaas** — a SaaS não vira instituição financeira.
- Resposta a reclamações financeiras vai direto para a Asaas (SAC regulamentado).
- Custo de manutenção menor; foco da SaaS em gestão condominial.

## 2.3 Endpoints da Asaas usados

Base prod: `https://www.asaas.com/api/v3` · Sandbox: `https://sandbox.asaas.com/api/v3`

| Operação | Endpoint | Quando chamamos |
| --- | --- | --- |
| Criar subconta | `POST /accounts` | Setup do condomínio (`StepFinancial`) |
| Onboarding link | `GET /myAccount/onboardingLink` (na subconta) | Após criar subconta → enviar para o síndico |
| Status da subconta | `GET /accounts/{id}` | Polling até `commercialInfo`/`bankAccountInfo`/`documentation` = `APPROVED` |
| Criar webhook | `POST /webhooks` (na subconta) | Após subconta aprovada — escutar PAYMENT_* |
| Criar customer | `POST /customers` | Ao cadastrar resp. financeiro (Resident) com `isFinancialResponsible=true` |
| Atualizar customer | `POST /customers/{id}` | Ao trocar email/telefone do resp. |
| Criar cobrança | `POST /payments` | `ChargesService.create` + `generateMonth` |
| Buscar cobrança | `GET /payments/{id}` | Reconciliação / detalhe |
| Cancelar cobrança | `DELETE /payments/{id}` | `ChargesService.cancel` (charge ainda `PENDING`) |
| QR Code Pix | `GET /payments/{id}/pixQrCode` | Tela de detalhe do morador |

Autenticação: header `access_token: <apiKey da subconta>` (note: NÃO é `Authorization: Bearer`).

## 2.3.1 Subconta vs Customer vs Payment — não confundir

A Asaas tem 3 entidades hierárquicas com regras diferentes. **Eu confundi isso no primeiro draft** — anota:

```
Subconta (Account)              ← QUEM RECEBE (síndico ou condo PJ)
  apiKey + walletId + KYC       ← cpfCnpj ÚNICO GLOBAL (regra BACEN)
  1 por condomínio
    │
    ├── Customer                ← QUEM PAGA (responsável financeiro)
    │     pertence à subconta   ← cpfCnpj único DENTRO da subconta
    │     1 por CPF por subconta
    │
    │     ├── Payment           ← 1 COBRANÇA
    │     ├── Payment              N por customer ao longo do tempo
    │     └── Payment              (mensal, avulsa…)
    │
    └── Customer (outro CPF)
          └── Payment
```

**Quem cria quando:**

| | Subconta | Customer | Payment |
| --- | --- | --- | --- |
| Quando criar | 1× no setup do condomínio | 1× ao designar responsável financeiro | A cada cobrança gerada |
| Frequência | Raríssimo (síndico nunca muda) | Raro (só em troca de responsável) | Mensal × N unidades + avulsas |
| Reuso | — | **Sim — mesmo CPF em 2 unidades = 1 customer** | Não (cada cobrança é uma) |
| Endpoint Asaas | `POST /accounts` | `POST /customers` | `POST /payments` |

**Casos comuns explicados:**

- **Mesmo CPF responsável de 2 apartamentos no mesmo condomínio** → 1 customer, 2 cobranças/mês apontando pra ele.
- **Mesmo CPF responsável em 2 condomínios diferentes** → 2 customers distintos (cada subconta é namespace isolado da Asaas), funciona automaticamente.
- **Síndico administra 2 condomínios** → precisa de 2 cpfCnpj diferentes pras subcontas (regra Asaas / BACEN). Solução típica: 1 subconta como CPF (síndico PF), outra como CNPJ (condo registrado em PJ). Ou síndicos diferentes.
- **Troca de responsável mantendo o CPF** (re-cadastro do mesmo proprietário) → reusa o customer.

## 2.4 Estratégia de credenciais

- A **conta master** da SaaS tem 1 `apiKey` global (`ASAAS_MASTER_API_KEY`, env var, vault).
- Cada **subconta** ganha seu próprio `apiKey` ao ser criada (devolvido **uma vez** no response — guardar imediatamente).
- O `apiKey` da subconta é **criptografado em repouso** (`pgcrypto` AES-256 ou KMS) na coluna `payment_accounts.asaas_api_key_enc`.
- Service `AsaasService` resolve a chave por `condominiumId` na hora do request — nunca expõe pra UI nem loga.

## 2.5 Modelo de split (futuro, deixar cabeado)

Hoje o repasse é 100% para a subconta do condomínio. Pra ativar uma taxa-SaaS (% por cobrança):

```ts
// no POST /payments
split: [
  { walletId: process.env.ASAAS_SAAS_WALLET_ID, percentualValue: 1.5 }
]
```

A subconta paga `1.5%` de cada cobrança recebida para a wallet da SaaS — Asaas calcula sobre o valor líquido (após taxas Asaas). Adoção fica para a fase 2 — quando houver pricing definido.

---

# 3. Modelo de dados

## 3.1 Novas entities

### `payment_accounts` (1 por condomínio)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | |
| `condominium_id` | uuid FK → `condominiums` ON DELETE CASCADE, **UNIQUE** | 1:1 |
| `holder_type` | enum (`'PF', 'PJ', 'MEI'`) | Tipo de titular escolhido no setup |
| `holder_cpf_cnpj` | varchar(14), unique global na Asaas | só dígitos |
| `holder_legal_name` | varchar | Nome ou razão social |
| `holder_birth_date` | date NULL | obrigatório PF (Asaas exige) |
| `holder_email` | varchar | email do síndico para Asaas |
| `holder_mobile_phone` | varchar(15) | obrigatório Asaas |
| `holder_income_value` | decimal(12,2) | "incomeValue" obrigatório (Asaas, desde 2024) |
| `holder_address` | jsonb | street, number, complement, province, postalCode, city, state |
| `asaas_account_id` | varchar | id retornado por `POST /accounts` |
| `asaas_wallet_id` | varchar | walletId — usado em split |
| `asaas_api_key_enc` | bytea | criptografado (pgcrypto) |
| `asaas_webhook_token` | varchar | segredo aleatório que pomos no header da subconta |
| `status` | enum (`'DRAFT', 'PENDING_DOCS', 'PENDING_REVIEW', 'ACTIVE', 'BLOCKED', 'REJECTED'`) | local, espelha aprovação Asaas |
| `commercial_info_status` | enum (Asaas) | NULL/PENDING/APPROVED/REJECTED |
| `bank_account_info_status` | enum (Asaas) | idem |
| `documentation_status` | enum (Asaas) | idem |
| `onboarding_url` | varchar(512) NULL | link gerado para o síndico enviar docs |
| `last_status_check_at` | timestamptz | polling |
| `created_at` / `updated_at` | timestamptz | |

Índices: `(condominium_id)`, `(asaas_account_id)`, `(status)`.

### `payment_customers` (1 por CPF por subconta — reusável entre unidades)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | |
| `payment_account_id` | uuid FK → `payment_accounts` | |
| `condominium_id` | uuid FK → `condominiums` (denormalizado p/ query) | |
| `cpf` | varchar(11) | chave do mapeamento |
| `legal_name` | varchar | nome do responsável (usado na cobrança) |
| `email` | varchar NULL | comprovantes Asaas |
| `phone_whatsapp` | varchar NULL | paralelo WhatsApp |
| `asaas_customer_id` | varchar | id retornado por `POST /customers` |
| `synced_at` | timestamptz | última sync com Asaas |
| `created_at` / `updated_at` | timestamptz | |

**Unique**: `(payment_account_id, cpf)` — **1 customer Asaas por CPF por subconta**.
Índice: `(asaas_customer_id)`.

**Decisão crítica — chave por CPF, não por `resident_id`**:

- **Mesmo CPF, 2+ unidades no mesmo condomínio**: o proprietário com 2 apartamentos vira **1 só** Customer Asaas. As 2 cobranças mensais apontam pro mesmo `customer` — economiza customer, é o jeito que o Asaas espera, e o morador vê tudo agrupado.
- **Mesmo CPF, condomínios diferentes**: cada condomínio tem subconta diferente → **namespaces Asaas isolados** → 2 Customers distintos (cus_X em sb_aurora, cus_Y em sb_bela_vista). Tudo automático.
- **Troca de responsável mantendo CPF** (ex.: re-cadastro do mesmo proprietário): customer existente é reusado.

**Tabela auxiliar `resident_payment_customer`** (mapeamento `Resident → PaymentCustomer`):

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `resident_id` | uuid PK FK → `residents` | |
| `payment_customer_id` | uuid FK → `payment_customers` | |
| `linked_at` | timestamptz | |

Resolução em runtime: "qual customer Asaas usar pra cobrança da unidade X?" → unidade tem responsável `R` → `R.id` aponta pra `payment_customer_id` → usa o `asaas_customer_id` correspondente.

### `charges` (extensão)

Adicionar colunas:

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `asaas_payment_id` | varchar UNIQUE NULL | id retornado por `POST /payments` |
| `asaas_invoice_url` | varchar(512) NULL | URL pública para pagar (Pix/boleto/cartão) |
| `asaas_pix_payload` | text NULL | "copia-cola" do Pix |
| `asaas_pix_qr_base64` | text NULL | imagem QR code Pix (base64) |
| `asaas_bank_slip_url` | varchar(512) NULL | PDF do boleto |
| `asaas_paid_via` | enum (`'PIX', 'BOLETO', 'CREDIT_CARD'`) NULL | preenchido no webhook PAYMENT_RECEIVED |
| `asaas_last_event` | varchar NULL | último evento processado — auditoria |
| `asaas_synced_at` | timestamptz NULL | última sincronização |

### `payment_webhook_events` (idempotência + auditoria)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | |
| `payment_account_id` | uuid FK | resolvido por `asaas_access_token` |
| `event` | varchar | ex.: PAYMENT_RECEIVED |
| `asaas_payment_id` | varchar | |
| `dedup_key` | varchar UNIQUE | hash sha-256 do `event` + `payment.id` + `payment.status` + `body.dateCreated` |
| `payload_raw` | jsonb | corpo bruto recebido |
| `processed_at` | timestamptz NULL | |
| `processing_error` | text NULL | |
| `received_at` | timestamptz default now() | |

Índice: `(asaas_payment_id, event)`.

## 3.2 Migrations sugeridas (ordem)

1. `add_payment_accounts_table` — cria `payment_accounts`
2. `add_payment_customers_table` — cria `payment_customers`
3. `extend_charges_with_asaas_fields` — adiciona colunas em `charges`
4. `add_payment_webhook_events_table` — cria `payment_webhook_events`
5. `index_residents_user_id_resp` — índice parcial `(condominium_id) WHERE is_financial_responsible = true` para query "tem responsável?" rápida

---

# 4. Regras de Negócio

## RN-PG-01 — Onboarding da subconta

| Código | Regra |
| --- | --- |
| RN-PG-01.1 | Toda subconta exige `holder_type` (PF/PJ/MEI) escolhido pelo síndico no setup |
| RN-PG-01.2 | Dados mínimos obrigatórios: nome/razão, cpfCnpj, email, mobilePhone, birthDate (PF), incomeValue, endereço completo |
| RN-PG-01.3 | Após `POST /accounts`, a SaaS recebe `apiKey` e `walletId` — `apiKey` é mostrado **uma vez** apenas pelo Asaas e armazenado encriptado |
| RN-PG-01.4 | O síndico recebe um **link de onboarding** da Asaas para enviar documentos (RG/CNH + selfie / CNPJ + contrato social + selfie do sócio) |
| RN-PG-01.5 | Status da subconta é polled a cada 30s (job) enquanto `status NOT IN ('ACTIVE', 'REJECTED', 'BLOCKED')` e até 24h após criação. Depois, polling diário |
| RN-PG-01.6 | Subconta `REJECTED` exibe motivo (campo `rejectReason` do Asaas) e bloqueia ações financeiras até resolução |

## RN-PG-02 — Customers (responsáveis financeiros)

| Código | Regra |
| --- | --- |
| RN-PG-02.1 | Apenas residentes com `is_financial_responsible = true` viram `payment_customer` |
| RN-PG-02.2 | Antes de criar customer na Asaas, **buscar** se já existe um com mesmo `(payment_account_id, cpf)`. Se sim, **reusar** o `asaas_customer_id` existente e apenas linkar no `resident_payment_customer` |
| RN-PG-02.3 | Quando NÃO existe: chamar `POST /customers` (Asaas), gravar `payment_customer` e `resident_payment_customer`. Falha não é silenciosa: bloquear a operação até sucesso |
| RN-PG-02.4 | Mesmo CPF em **2+ unidades** do **mesmo condomínio** = **1 só customer** Asaas, com 2+ Payments mensais apontando pra ele. Não duplicar |
| RN-PG-02.5 | Mesmo CPF em **condomínios diferentes** = customers distintos (1 por subconta) — natural, sem código especial |
| RN-PG-02.6 | Ao atualizar email/telefone do residente responsável, sincronizar via `POST /customers/{id}` na subconta correspondente |
| RN-PG-02.7 | Ao **trocar** responsável de uma unidade (RN-02.4): se o novo CPF já tem customer naquela subconta, reusar; se não, criar. **Não deletar** o customer anterior — ele pode ter cobranças vinculadas |
| RN-PG-02.8 | CPF inválido na Asaas (Receita inválida ou bloqueado) → erro 422 visível pro síndico, com indicação de qual residente precisa corrigir |

## RN-PG-03 — Pré-condições para emitir cobrança

| Código | Regra |
| --- | --- |
| RN-PG-03.1 | **BLOQUEAR** geração de cobrança (manual ou cron) quando `payment_accounts.status != 'ACTIVE'` |
| RN-PG-03.2 | **BLOQUEAR** geração quando alguma unidade **não isenta** estiver sem residente `is_financial_responsible=true`. Resposta 422 lista os `unitId`s pendentes |
| RN-PG-03.3 | **Banner permanente** no dashboard do síndico até as condições estarem OK: "Configure os pagamentos e atribua responsáveis financeiros para começar a cobrar." |
| RN-PG-03.4 | Geração de **mês inteiro** é all-or-nothing: ou todas as unidades elegíveis são cobradas, ou nenhuma. Falha em uma → rollback de transação local + dispara alerta admin |

## RN-PG-04 — Emissão de cobrança

| Código | Regra |
| --- | --- |
| RN-PG-04.1 | Cada `Charge` local com status `PENDING` corresponde a 1 `Payment` na Asaas (`billingType = UNDEFINED` por padrão → cliente escolhe Pix/boleto/cartão) |
| RN-PG-04.2 | Os campos enviados: `customer` (asaas_customer_id), `value` (R$), `dueDate`, `externalReference` (charge.id local), `description` (auto: "Condomínio X · Bloco A 101 · Maio/2026") |
| RN-PG-04.3 | Quando a SaaS futuramente cobrar taxa, o array `split` é injetado automaticamente pelo `AsaasService` (config feature-flag) |
| RN-PG-04.4 | Após criar, gravar `asaas_payment_id`, `asaas_invoice_url`, `asaas_pix_payload`, `asaas_pix_qr_base64`, `asaas_bank_slip_url` |
| RN-PG-04.5 | **Idempotência**: usar `externalReference` para evitar duplicação. Se erro/timeout no `POST /payments`, retry com mesmo `externalReference` — Asaas aceita |
| RN-PG-04.6 | Cobrança gerada para **unidade isenta** (`isExempt=true`) — **NÃO ENVIA** à Asaas, fica como `EXEMPT` local |
| RN-PG-04.7 | Cobrança **avulsa** (não-recorrente) segue o mesmo fluxo. A descrição vinda do `Charge.description` é mesclada no campo `description` Asaas |

## RN-PG-05 — Recebimento (webhook)

| Código | Regra |
| --- | --- |
| RN-PG-05.1 | Endpoint público `POST /api/v1/integrations/asaas/webhook` recebe payloads. Auth via header `asaas-access-token` (segredo único por subconta — usado para resolver `payment_account_id`) |
| RN-PG-05.2 | Token inválido → 401 sem corpo. **Não revelar** se a subconta existe |
| RN-PG-05.3 | **Idempotência**: gravar em `payment_webhook_events` com `dedup_key` unique. Conflito → 200 OK (Asaas espera 200 para parar retry) |
| RN-PG-05.4 | Eventos relevantes para v1: `PAYMENT_CREATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`, `PAYMENT_RESTORED` |
| RN-PG-05.5 | `PAYMENT_RECEIVED` → atualiza `charges.status = 'PAID'`, `paid_at`, `asaas_paid_via`. Dispara notif local `CHARGE_PAID` para moradores + admins (já implementado) |
| RN-PG-05.6 | `PAYMENT_OVERDUE` da Asaas → garantir `charges.status = 'OVERDUE'`. Não envia WhatsApp se já enviamos no nosso próprio cron (`runOverdueAndReminders`) — usar a flag `asaas_last_event` para dedup |
| RN-PG-05.7 | `PAYMENT_REFUNDED` → criar registro de auditoria + notif para síndico e morador |
| RN-PG-05.8 | Processamento assíncrono via fila BullMQ (`QUEUE_ASAAS_WEBHOOK`) para responder o webhook em <1s |
| RN-PG-05.9 | Falha no processamento → fica em `payment_webhook_events.processing_error`. Job de reprocessamento manual via endpoint admin |

## RN-PG-06 — Reconciliação

| Código | Regra |
| --- | --- |
| RN-PG-06.1 | Cron diário (3:00 BRT) reconciliando: para cada charge `PENDING/OVERDUE` com mais de 48h e com `asaas_payment_id`, chamar `GET /payments/{id}` e re-sincronizar status — cobre webhooks perdidos |
| RN-PG-06.2 | Discrepância detectada (Asaas diz `RECEIVED`, local diz `PENDING`) → corrige local, dispara notif de reconciliação para o síndico |
| RN-PG-06.3 | Cobrança que sumiu da Asaas (foi deletada manualmente no painel) → marcar localmente como `CANCELED` com `cancelReason = 'Cancelada no Asaas (reconciliação)'` |

## RN-PG-07 — Cancelamento e isenção

| Código | Regra |
| --- | --- |
| RN-PG-07.1 | `ChargesService.cancel` chama `DELETE /payments/{id}` na Asaas **antes** de marcar local como `CANCELED`. Falha na Asaas aborta cancelamento local |
| RN-PG-07.2 | Não é possível cancelar cobrança já `PAID` ou `OVERDUE` com pagamento parcial (mesma regra Asaas) |
| RN-PG-07.3 | `ChargesService.exempt` (transição → `EXEMPT`) **também** chama `DELETE /payments/{id}` para retirar a cobrança da fila Asaas (não tem sentido cobrar uma isenta) |

## RN-PG-08 — Segurança e LGPD

| Código | Regra |
| --- | --- |
| RN-PG-08.1 | `apiKey` da subconta nunca volta em response da API CondoSync, nunca aparece em log |
| RN-PG-08.2 | `cpfCnpj` do síndico e do responsável são tratados como PII — mascarados em logs (`***.***.***-XX`) |
| RN-PG-08.3 | Endpoint webhook não aceita CORS — só Asaas (POST do server deles) |
| RN-PG-08.4 | Em ambiente de produção, exigir `NODE_ENV=production` e `ASAAS_ENV=production` simultaneamente. Mistura sandbox/prod é bloqueada no boot |
| RN-PG-08.5 | Retenção de eventos webhook: 180 dias (depois purgar) |

---

# 5. Histórias de Usuário

## US-PG-01 — Síndico escolhe tipo de titular no setup

> "Como síndico, ao terminar o setup do condomínio, quero escolher se vou receber as cobranças como **Pessoa Física** ou **Pessoa Jurídica/MEI**, e informar meus dados bancários, para que o dinheiro caia direto na minha conta."

**Critérios de aceite**

- Novo passo `StepPayments` no setup wizard, após `StepFinancial`.
- Toggle `PF / MEI / PJ` no topo. Campos do formulário se adaptam:
  - PF: nome completo, CPF, data de nascimento, telefone, renda mensal.
  - MEI: nome social, CNPJ, telefone, faturamento mensal.
  - PJ: razão social, CNPJ, telefone, faturamento mensal.
- Endereço (CEP autocompleta) — sempre obrigatório.
- Validação client-side de CPF/CNPJ (algoritmo) antes do submit.
- Submit cria `payment_accounts` em estado `DRAFT`, chama `POST /accounts` Asaas, armazena retorno em estado `PENDING_DOCS`.
- Mostra link de onboarding pra envio de documentos com botão "Enviar agora" (deeplink para painel Asaas).
- "Continuar depois" deixa o setup terminar — síndico volta nas configurações.

## US-PG-02 — Síndico envia documentos para liberar a subconta

> "Como síndico, depois de criar a conta, quero enviar meus documentos (RG/CNH ou contrato social) sem fricção, para liberar minha conta para receber pagamentos."

- Tela `Configurações → Pagamentos` mostra cards de status: comercial (✅/❌), bancário (✅/❌), documentação (✅/❌).
- Cada card pendente tem CTA "Resolver agora" → abre URL de onboarding Asaas em nova aba.
- Banner contextual: "Sua conta está em análise — pagamentos serão liberados em até 48h".
- Notificação local quando todos os 3 ficam `APPROVED` ("Conta ativa! Você já pode emitir cobranças.").

## US-PG-03 — Síndico tenta gerar cobrança sem ter tudo configurado

> "Como síndico, quando tento gerar cobranças, quero ser orientado sobre o que falta (subconta? responsáveis financeiros?) em vez de receber um erro genérico."

- Botão "Gerar mês" desabilitado quando: subconta != ACTIVE **ou** alguma unidade não isenta sem responsável.
- Tooltip no botão: "X unidades sem responsável financeiro · pendência na conta digital".
- Dialog "Gerar cobranças" mostra checklist no topo:
  - ☐ Conta ativa para receber pagamentos
  - ☐ Todas as unidades têm responsável financeiro (3 pendentes)
  - Link "Resolver" para cada item.
- Backend retorna 422 com `code: 'GENERATION_BLOCKED'` e `unfulfilled: ['ACCOUNT_NOT_ACTIVE', 'MISSING_FINANCIAL_RESPONSIBLES']` + `details.pendingUnitIds`.

## US-PG-04 — Síndico gera cobranças com Asaas ativo

> "Como síndico, ao gerar as cobranças do mês, quero que elas sejam emitidas automaticamente para o CPF do responsável financeiro de cada unidade, com opção de Pix/boleto/cartão."

- Mesmo fluxo atual de `GenerateChargesDialog`, agora com:
  - Toast melhorado: "N cobranças geradas e enviadas à Asaas. Os moradores receberão por WhatsApp."
  - Em caso de falha parcial (1 unidade rejeitada pela Asaas), mostrar tela de resumo: "X criadas, Y falharam (motivo)" com botão "Tentar novamente".
- Mesma operação dispara WhatsApp (continua) + notif in-app `CHARGE_CREATED` (continua).

## US-PG-05 — Morador paga via Pix / boleto / cartão

> "Como morador (responsável financeiro), quero pagar a cobrança no método que eu preferir (Pix, boleto ou cartão), direto pelo CondoSync."

- `ChargeDetailDialog` ganha 3 abas: **Pix · Boleto · Cartão**.
  - **Pix**: QR Code visual + botão "Copiar código" + texto "Pague em qualquer banco — confirmação imediata".
  - **Boleto**: linha digitável copiável + botão "Baixar PDF" (abre `asaas_bank_slip_url`).
  - **Cartão**: link "Pagar com cartão" → abre página hospedada da Asaas em iframe ou redirect (Asaas Checkout).
- Após pagar, a tela faz refetch a cada 5s por 60s para detectar a confirmação (sem precisar fechar/abrir).
- Toast de sucesso quando webhook chega: "Pagamento confirmado!".

## US-PG-06 — Síndico vê extrato/saldo

> "Como síndico, quero ver quanto entrou no mês, quanto saiu, quanto está disponível para saque, e como sacar."

- Card no dashboard: "Saldo disponível: R$ X,XX · Disponível em D+Y".
- Botão "Abrir painel Asaas" → deep-link autenticado para painel.
- (Opcional v1.5) Mostrar últimas 10 transações via `GET /finance/transactions` da Asaas.

## US-PG-07 — Sistema reconcilia automaticamente

> "Como sistema, preciso que todo pagamento confirmado pela Asaas seja refletido no CondoSync mesmo que o webhook caia."

- Webhook é o canal primário (real-time).
- Cron diário às 3h BRT itera charges `PENDING/OVERDUE` com idade > 48h e `asaas_payment_id != NULL` → `GET /payments/{id}` → re-sincroniza.
- Métrica observável: % cobranças onde webhook bateu primeiro vs reconciliação (alvo: >95% webhook).

## US-PG-08 — Síndico troca de banco / dados

> "Como síndico, quero poder alterar a chave bancária da minha conta Asaas pelo painel CondoSync."

(v1.5 — pelo painel Asaas no v1.) Deeplink para `Configurações Asaas → Dados bancários`.

## US-PG-09 — Morador estorna pagamento

> "Como morador, se eu pago errado, posso pedir estorno." 

(v2) — Asaas suporta estorno até 90 dias. Vai pra fluxo manual com aprovação síndico.

---

# 6. Mudanças no backend

## 6.1 Estrutura de pastas (novo módulo)

```
backend/src/modules/payments/
├── payments.module.ts
├── asaas/
│   ├── asaas.client.ts          # Wrapper HTTP (axios) com auth dinâmico
│   ├── asaas.service.ts         # Fachada: createSubaccount, createCustomer, createPayment, ...
│   ├── asaas.errors.ts          # Mapeamento de erros HTTP → exceptions de domínio
│   └── dto/                     # Tipos das requests/responses Asaas
├── accounts/
│   ├── payment-accounts.service.ts   # CRUD payment_accounts + lifecycle (poll status, refresh)
│   ├── payment-accounts.controller.ts
│   ├── payment-accounts.repository.ts
│   └── dto/
├── customers/
│   ├── payment-customers.service.ts  # Cria/sync customer ao mexer no responsável
│   └── payment-customers.repository.ts
├── webhook/
│   ├── asaas-webhook.controller.ts   # POST /integrations/asaas/webhook
│   ├── asaas-webhook.guard.ts        # Valida asaas-access-token
│   ├── asaas-webhook.processor.ts    # Fila BullMQ
│   └── asaas-event-handlers/         # 1 handler por tipo de evento
│       ├── payment-received.handler.ts
│       ├── payment-overdue.handler.ts
│       ├── payment-refunded.handler.ts
│       └── ...
└── reconciliation/
    └── reconciliation.scheduler.ts   # Cron diário GET /payments/{id}
```

## 6.2 Mudanças em módulos existentes

### `ChargesService`

- **`generateMonth`** — pre-flight novo:
  1. `await this.paymentAccountsService.requireActive(condominiumId)` — lança 422 se != ACTIVE.
  2. `await this.unitsService.requireAllFinancialResponsibles(condominiumId)` — lança 422 com lista.
  3. Iterar unidades, **agora também emitindo na Asaas dentro de uma transação local**. Se uma falha → rollback de toda a operação (RN-PG-03.4). Detalhe: o `POST /payments` não é transacional, então usamos compensação — se save local commitou mas Asaas falhou em alguma, rollback chama `DELETE /payments` em todas as criadas.

- **`create`** (avulsa) — mesma pre-flight + 1 chamada Asaas.

- **`markPaid` / `markPaidByResident`** — quando admin baixa pagamento manualmente (caso o morador pagou fora do app), também chamar `POST /payments/{id}/receiveInCash` na Asaas para fechar a cobrança no extrato deles. Sem isso, eles continuam tentando cobrar.

- **`cancel` / `exempt`** — chamar `DELETE /payments/{id}` antes da transição local (RN-PG-07).

### `ResidentsService`

- Ao criar/promover um residente com `isFinancialResponsible=true`: criar `payment_customer` (chama Asaas).
- Ao trocar responsável: atualizar `payment_customer.resident_id` para apontar o novo.
- Ao remover/despromover responsável atual: marcar `payment_customer.synced_at = NULL` (cobranças antigas continuam vinculadas).

### `SetupModule`

- Novo step `StepPayments` (ver §7).

### `app.module.ts`

- Registrar `PaymentsModule`.
- Adicionar env vars (ver §10).
- Registrar fila `QUEUE_ASAAS_WEBHOOK`.

## 6.3 Novo controller — Payment Accounts

```ts
// POST   /condominiums/:id/payment-account              (cria subconta)
// GET    /condominiums/:id/payment-account              (status atual)
// POST   /condominiums/:id/payment-account/refresh      (re-checa status na Asaas)
// GET    /condominiums/:id/payment-account/onboarding-link  (gera link novo de docs)
```

Apenas `ADMIN` (síndico criador). `SUB_ADMIN` lê mas não escreve.

## 6.4 Novo controller — Webhook

```ts
@Public()
@Throttle({ webhook: { limit: 240, ttl: 60_000 } })   // 4/s — Asaas chega em rajadas
@Post('/integrations/asaas/webhook')
@UseGuards(AsaasWebhookGuard)
async receive(@Body() body, @Headers('asaas-access-token') token, @Req() req) {
  // 1. Guard já resolveu payment_account_id pelo token
  // 2. Salva em payment_webhook_events (dedup via UNIQUE) — 200 OK mesmo em duplicata
  // 3. Enfileira QUEUE_ASAAS_WEBHOOK
  // 4. Responde 200 imediatamente
}
```

## 6.5 Erros / códigos

| Code | HTTP | Quando |
| --- | --- | --- |
| `PAYMENT_ACCOUNT_NOT_ACTIVE` | 422 | Tentou gerar/criar cobrança com subconta != ACTIVE |
| `MISSING_FINANCIAL_RESPONSIBLES` | 422 | Tentou gerar mês inteiro sem responsável em alguma unidade |
| `INVALID_CPF_CNPJ` | 422 | Asaas rejeitou cpfCnpj |
| `ASAAS_DUPLICATE_PAYMENT` | 409 | Já existe payment com mesmo externalReference |
| `ASAAS_UPSTREAM_TIMEOUT` | 504 | Asaas demorou — exibir "tentar novamente" |
| `ASAAS_BLOCKED_ACCOUNT` | 423 | Subconta bloqueada — síndico precisa contatar Asaas |

---

# 7. Mudanças no frontend (PWA)

## 7.1 Setup wizard

Novo step `StepPayments` entre `StepFinancial` e `StepUnits`:

```
StepWelcome → StepIdentity → StepFinancial → [NOVO] StepPayments → StepUnits → StepDone
```

Conteúdo do step:

1. Header: "Conta para receber as cobranças"
2. Toggle PF / MEI / PJ (com explicação resumida do impacto fiscal de cada)
3. Form dinâmico conforme escolha (nome, cpfCnpj, dataNascimento PF-only, telefone, renda, endereço com CEP)
4. CTA "Criar conta digital" → cria `payment_account` em PENDING
5. Card pós-criação: "Sua conta está sendo analisada. Envie seus documentos." + botão "Enviar documentos agora" (abre `onboarding_url`)
6. Botão "Continuar para unidades" (não bloqueia — síndico pode terminar setup e resolver depois)

## 7.2 Configurações → Pagamentos (página nova)

`/settings/payments` (ou subseção em `/condominiums/:id` aba "Pagamentos"):

- Card de status com 3 indicadores: Comercial / Bancário / Documentação
- Botão "Reenviar para análise"
- Botão "Abrir painel Asaas"
- Bloco "Saldo disponível" + "A receber em 7 dias" + "Saques recentes"
- Toggle "Aceitar cartão de crédito" (subconta pode desabilitar)
- Auditoria: tabela de últimos 20 eventos webhook (debug)

## 7.3 Dashboard

- Banner amarelo até subconta = ACTIVE.
- Banner amarelo até 100% das unidades não isentas terem responsável (já existe — só atualizar texto: "Sem responsável financeiro, não é possível emitir cobranças").
- Card "Conta digital" no resumo (com saldo + link).

## 7.4 Charges

- `GenerateChargesDialog` ganha **checklist de pré-condições** no topo (US-PG-03).
- `ChargeDetailDialog` reformulado:
  - Aba "Pix" mostra QR Code (img base64) + texto copiável.
  - Aba "Boleto" mostra linha digitável + "Baixar PDF".
  - Aba "Cartão" → link Asaas Checkout.
  - Botão "Já paguei" (morador) só aparece se `asaas_paid_via IS NULL` AND `status IN ('PENDING','OVERDUE')`.

## 7.5 Units

- Quando admin abre uma unidade sem responsável financeiro, banner vermelho: "Esta unidade ainda não pode receber cobranças. Defina um responsável financeiro antes da próxima geração mensal."
- `UnitsListColumn` ganha contador de pendência no chip: "Sem responsável · 3" (clica → filtra).

---

# 8. Mudanças no app mobile (RN)

| Área | Mudança |
| --- | --- |
| `features/charges/screens/ChargePayment` | Trocar tela atual (só Pix manual) por componente com 3 abas Pix/Boleto/Cartão consumindo os campos `asaas_*` |
| `features/charges/services/charges.service.ts` | Adicionar `getPaymentMethods(chargeId)` (Pix QR + payload + boletoUrl) |
| `features/auth/screens/Settings` | Item "Pagamentos" — síndico abre o painel Asaas via browser nativo |
| Notificações | `CHARGE_PAID` deep-link já vai pra `/charges/:id` — manter |
| `App.tsx` | Listener de deep-link `condosync://payment-success?charge=...` (caso usemos retorno do Asaas Checkout) |

---

# 9. Operações & observabilidade

| Item | O que |
| --- | --- |
| Métrica | `payment_account.transitions{from,to}` — fluxo de aprovação |
| Métrica | `asaas.request{op,status}` — latência + erro por endpoint Asaas |
| Métrica | `webhook.received{event}` e `webhook.processed{event,outcome}` |
| Métrica | `charges.created{source}` source ∈ {api, cron, manual} |
| Alerta (Sentry) | webhook com falha de processamento > 5 em 10min |
| Alerta | subconta bloqueada |
| Alerta | latência Asaas P95 > 3s |
| Job admin | "Reprocessar webhook event" — payload já está no banco |
| Job admin | "Forçar reconciliação de cobrança X" |
| Logs | mascarar cpfCnpj e qualquer apiKey |

---

# 10. Variáveis de ambiente

| Nome | Default | Notas |
| --- | --- | --- |
| `ASAAS_ENV` | `sandbox` | `sandbox` ou `production` |
| `ASAAS_API_BASE_URL` | `https://sandbox.asaas.com/api/v3` | derivado do ASAAS_ENV |
| `ASAAS_MASTER_API_KEY` | — | obrigatório, vault |
| `ASAAS_SAAS_WALLET_ID` | — | opcional (split fase 2) |
| `ASAAS_WEBHOOK_PUBLIC_BASE_URL` | — | URL pública para Asaas chamar o webhook (precisa estar acessível) |
| `ASAAS_ACCOUNTS_ENABLED` | `true` | kill-switch para emergências |
| `ASAAS_DEFAULT_SPLIT_PERCENT` | `0` | quando >0, split é injetado em todas as cobranças |
| `ASAAS_REQUEST_TIMEOUT_MS` | `15000` | |
| `ASAAS_RETRY_MAX` | `3` | tentativas em 5xx/timeout |
| `PAYMENTS_ENCRYPTION_KEY` | — | 32 bytes base64 (AES-256) para criptografar apiKey |

---

# 11. LGPD & compliance

| Tema | Tratamento |
| --- | --- |
| Dado pessoal armazenado | CPF/CNPJ síndico + CPF morador, endereço, telefone, email, renda mensal — base legal: execução de contrato (Art. 7º, V LGPD) + obrigação legal (Art. 7º, II) |
| Compartilhamento com Asaas | Necessário para o serviço de pagamento. Cláusula explícita na ToS no setup |
| Retenção | Dados mantidos enquanto houver cobrança ativa ou histórico fiscal de até 5 anos |
| Right to be forgotten | Síndico que sai → marcar subconta como `BLOCKED` e bloquear novas cobranças. Solicitação completa → pedido manual via SAC (Asaas tem fluxo próprio) |
| Logs | CPF/CNPJ mascarado por padrão em logs aplicacionais |

---

# 12. Plano de rollout

## Fase 0 — Prep (1 semana)

- Conta Asaas SaaS criada (sandbox + produção).
- `walletId` master anotado.
- Webhook URL pública roteada via HTTPS.
- Env vars provisionadas em vault.
- Migrations 1-5 rodadas em staging.

## Fase 1 — MVP backend (2 semanas)

- `PaymentsModule` + `AsaasService` cliente HTTP.
- `payment_accounts` CRUD + endpoint criar subconta.
- `payment_customers` CRUD automático no `ResidentsService`.
- `ChargesService` integrado: `generateMonth`, `create`, `cancel`, `exempt` chamam Asaas.
- Webhook + handler `PAYMENT_RECEIVED` + idempotência.
- Reconciliation cron.
- **Bloqueio** de geração sem responsáveis / subconta inativa.
- Testes unitários + e2e com Asaas sandbox.

## Fase 2 — Frontend PWA (1 semana)

- `StepPayments` no setup.
- `/settings/payments`.
- `ChargeDetailDialog` com abas Pix/boleto/cartão.
- Banner de bloqueio no dashboard.
- Checklist no `GenerateChargesDialog`.

## Fase 3 — App mobile (1 semana)

- `ChargePayment` reescrito com 3 abas.
- Settings → Pagamentos abre painel Asaas no browser.

## Fase 4 — Beta com 1 condomínio (2 semanas)

- Onboarding manual com síndico beta-tester.
- Acompanhar webhook, reconciliação, taxa de sucesso.
- Ajustes finos.

## Fase 5 — GA + split de SaaS-fee opcional (após pricing definido)

- Ativar `ASAAS_DEFAULT_SPLIT_PERCENT > 0`.
- Comunicação aos clientes existentes.

---

# 13. Riscos & mitigações

| Risco | Severidade | Mitigação |
| --- | --- | --- |
| Síndico não envia documentos → subconta nunca ativa | Alta | Lembrete diário in-app + email após 3, 7, 14 dias |
| Webhook não chega (DNS/rede) | Alta | Reconciliation cron pega — alvo SLA: 24h max delay |
| Asaas down | Média | Filas + retry exponencial + status page interna |
| CPF do responsável inválido (Receita) | Média | Validação client-side + erro claro na UI ao salvar resident |
| Duplicata de Payment por retry | Baixa | `externalReference` único + dedup no banco |
| Split mal configurado cobra do síndico errado | Alta | Feature flag + auditoria de toda cobrança que aplica split |
| Conciliação contábil quebra (síndico contesta valor) | Média | Manter log imutável de todos os eventos + valores brutos/líquidos |

---

# 14. Perguntas em aberto (resolver antes da Fase 1)

1. **Quem paga a taxa Asaas em si?** Asaas cobra taxa por cobrança (Pix grátis até X/mês, boleto R$ 1,99, cartão %). Decisão: cair no extrato da subconta do síndico (default) ou repassar via desconto antes do split. **Sugestão: default Asaas (síndico paga).**
2. **Cobrança parcelada no cartão é permitida?** Tecnicamente sim (até 21x). Politicamente — síndicos geralmente preferem não.  **Sugestão: feature flag por condomínio, default OFF.**
3. **Antecipação de recebíveis?** Asaas oferece. Fora do escopo v1.
4. **Estorno via app?** Asaas suporta. Fora do escopo v1, sairá manual via painel Asaas.
5. **Cobranças que existem hoje (antes do go-live)?** Migrar todas para Asaas seria caro. **Sugestão: only-new — cobranças antigas continuam com chave Pix manual; só novas a partir do go-live passam pela Asaas.**

---

# 15. Referências

## Documentação oficial Asaas consultada

- [Criar subconta — `POST /accounts`](https://docs.asaas.com/reference/criar-subconta)
- [Criação de subcontas — fluxo geral](https://docs.asaas.com/docs/criacao-de-subcontas)
- [Detalhamento do fluxo de aprovação de subcontas](https://docs.asaas.com/docs/detalhamento-do-fluxo-de-aprova%C3%A7%C3%A3o-de-subcontas)
- [Subcontas Standard vs White Label](https://docs.asaas.com/docs/creating-subaccounts)
- [Onboarding e envio de documentos via link](https://docs.asaas.com/docs/onboarding-and-sending-documents-via-link)
- [Gerenciamento de chaves de API de subcontas](https://docs.asaas.com/docs/gerenciamento-de-chaves-de-api-de-subcontas)
- [Split de pagamentos — overview](https://docs.asaas.com/docs/split-de-pagamentos)
- [Split em cobranças avulsas](https://docs.asaas.com/docs/split-em-cobrancas-avulsas)
- [Webhooks — overview](https://docs.asaas.com/docs/about-webhooks)
- [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Receber eventos Asaas no endpoint webhook](https://docs.asaas.com/docs/receive-asaas-events-at-your-webhook-endpoint)
- [Criar novo webhook pela API](https://docs.asaas.com/docs/criar-novo-webhook-pela-api)
- [Cobranças via Pix / QR Code dinâmico](https://docs.asaas.com/docs/cobrancas-via-pix)
- [Cobranças via boleto](https://docs.asaas.com/docs/cobrancas-via-boleto)
- [Cobranças via cartão de crédito](https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito)
- [Criar cobrança parcelada](https://docs.asaas.com/docs/criar-uma-cobranca-parcelada)
- [Guia de cobranças — introdução](https://docs.asaas.com/docs/guia-de-cobrancas)

## Documentos internos relacionados

- [`01_regras_historias_usuario.md`](./01_regras_historias_usuario.md) — RN-02 (responsável financeiro), RN-03 (financeiro)
- [`02_backend_guia_tecnico.md`](./02_backend_guia_tecnico.md) — padrões de módulo NestJS
- [`03_frontend_guia_tecnico.md`](./03_frontend_guia_tecnico.md) — padrões PWA

---

*Fim do documento. Mantenha esta especificação como contrato — implementação deve referenciar as RN/US por código (RN-PG-XX / US-PG-XX) em PRs e commits.*
