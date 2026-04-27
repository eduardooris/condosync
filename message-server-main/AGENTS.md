# Message Server (Go) — Guia para Agentes de IA

> **Fonte de verdade do código real do `message-server`.** Em caso de divergência com `GUIA_TECNICO.md` (escrito antes de `TRANSPORT_MODE=http`), o `AGENTS.md` ganha.
>
> Antes de tocar qualquer linha, leia também: [`../AGENTS.md`](../AGENTS.md).

## Índice

1. [Stack real](#1-stack-real)
2. [Arquitetura — Hexagonal](#2-arquitetura--hexagonal)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Modos de transporte (kafka vs http)](#4-modos-de-transporte-kafka-vs-http)
5. [Fluxos de dados](#5-fluxos-de-dados)
6. [Convenções de nomenclatura](#6-convenções-de-nomenclatura)
7. [Padrões de implementação](#7-padrões-de-implementação)
8. [Tratamento de erros (`errs.Error`)](#8-tratamento-de-erros-errserror)
9. [Persistência (Postgres + whatsmeow)](#9-persistência-postgres--whatsmeow)
10. [Confiabilidade — outbox/inbox](#10-confiabilidade--outboxinbox)
11. [Configuração](#11-configuração)
12. [Logging, métricas, tracing](#12-logging-métricas-tracing)
13. [Testes](#13-testes)
14. [Build, lint, Docker](#14-build-lint-docker)
15. [Como adicionar um caso de uso novo (checklist)](#15-como-adicionar-um-caso-de-uso-novo-checklist)
16. [Anti-padrões — recusar em code review](#16-anti-padrões--recusar-em-code-review)

---

## 1. Stack real

| Camada | Escolha | Justificativa |
| --- | --- | --- |
| Linguagem | Go 1.23+ | Performance, deploy estático, baixa RAM |
| WhatsApp | `go.mau.fi/whatsmeow` | Acesso nativo ao protocolo WhatsApp |
| HTTP | `net/http` (stdlib) | Sem framework — `http.ServeMux` |
| Mensageria opcional | `github.com/twmb/franz-go` | Modo `kafka` (legado) |
| Webhook out | `net/http` + HMAC SHA256 | Modo `http` (atual integração com backend Nest) |
| DB | `github.com/jackc/pgx/v5` + `pgxpool` | Pool nativo, sem ORM |
| Migrations | `golang-migrate/migrate/v4` | SQL puro versionado |
| Logger | `log/slog` (stdlib) wrap em `internal/platform/logger` | Sem dependência externa |
| Config | `os.Getenv` + `joho/godotenv` (local) | 12-Factor |
| Identidade | `github.com/google/uuid` | UUID v4 |
| Observabilidade | `prometheus/client_golang`, `go.opentelemetry.io/otel` | `/metrics` em porta dedicada |
| Container | Distroless nonroot | Imagem mínima e segura |

> **Regra:** novas dependências exigem justificativa em PR. Prefira stdlib. Bibliotecas devem ter manutenção ativa, license permissiva (Apache-2.0/MIT/BSD), sem CGO.

## 2. Arquitetura — Hexagonal

**Ports & Adapters** com 3 camadas estritas:

```
+-----------------------------------------------------------+
|  ADAPTERS                                                 |
|   inbound:  http (commands_handler, health_handler)       |
|             kafka (router, idempotent handler)            |
|   outbound: postgres, whatsmeow, kafkasink, webhooksink,  |
|             outbox (publisher/relay/recorder)             |
+-----------------------------------------------------------+
|  APPLICATION (use cases + ports + events)                 |
+-----------------------------------------------------------+
|  DOMAIN (entidades + invariantes + ports do dominio)      |
+-----------------------------------------------------------+
|  PLATFORM (kafka, postgres, logger, metrics, tracing) — infra reutilizavel
|  SHARED   (errs, id) — cross-cutting puro
```

### Regras inegociáveis de import
1. `domain/` importa apenas stdlib + `shared/errs` + `shared/id`. **Nunca** `application/`, `adapter/`, `platform/`.
2. `application/` importa de `domain/` e dos ports declarados em `application/ports/`. **Nunca** `adapter/` ou `platform/`. Casos de uso que precisam de transação dependem do port `ports.TxRunner`, **não** de `*tx.Manager`.
3. Adapters concretos são instanciados **somente** em `internal/bootstrap/app.go`. Nenhum outro pacote chama `kafka.New`, `pgxpool.New`, etc.
4. Comunicação entre camadas usa **structs imutáveis** (`Command`/`Input` na entrada, `Output` na saída). Nada de `map[string]any`.
5. Adapters podem declarar **interfaces locais mínimas** (princípio "accept interfaces, return structs") quando isso facilita teste — sem expor novos tipos públicos.

## 3. Estrutura de pastas

```
message-server-main/
├── cmd/
│   └── server/                  # main.go — entrypoint
├── internal/
│   ├── bootstrap/
│   │   └── app.go               # Wiring de TODAS as dependencias
│   ├── config/
│   │   └── config.go            # os.Getenv + defaults + validacao
│   ├── domain/
│   │   ├── instance/
│   │   │   └── instance.go      # Entity + Repository + Driver (ports)
│   │   └── message/
│   │       └── message.go
│   ├── application/
│   │   ├── events/              # EventEnvelope[T] + payload structs
│   │   ├── ports/               # EventPublisher, TxRunner (transversais)
│   │   └── usecase/             # Um arquivo por caso de uso (verbo_substantivo.go)
│   ├── adapter/
│   │   ├── inbound/
│   │   │   ├── http/            # commands_handler, health_handler
│   │   │   └── kafka/           # router + idempotent
│   │   └── outbound/
│   │       ├── kafkasink/       # outbox.Sink via Kafka
│   │       ├── memoryrepo/      # Repos in-memory (testes)
│   │       ├── outbox/          # Publisher, Recorder, Relay
│   │       ├── postgres/        # Repos reais (InstanceRepository, MessageRepository)
│   │       ├── webhooksink/     # outbox.Sink via webhook HTTP (HMAC)
│   │       └── whatsmeow/       # Driver WhatsApp + Dispatcher
│   ├── platform/
│   │   ├── kafka/               # Cliente franz-go (Producer + Consumer)
│   │   ├── logger/              # Wrapper slog (formato JSON)
│   │   ├── metrics/             # Registry Prometheus isolado
│   │   ├── postgres/            # pgxpool.New + tx.Manager + migrate.Run
│   │   └── tracing/             # OTel setup (W3C TraceContext)
│   └── shared/
│       ├── errs/                # Tipo errs.Error + Kind
│       └── id/                  # Geracao/parse de UUID
├── migrations/                  # SQL versionado (000001_*.up.sql / .down.sql)
├── secrets/                     # Mantenha apenas placeholders no repo
├── Dockerfile                   # Distroless nonroot
├── Makefile                     # Atalhos: fmt vet test build run
├── .env.example                 # Sincronizado com config.Config
├── go.mod / go.sum
├── README.md
├── GUIA_TECNICO.md              # Histórico — pode estar defasado
└── AGENTS.md                    # ESTE arquivo — fonte de verdade
```

**Nomenclatura de pacote:** sempre singular minúsculo, sem underscores (`instance` não `instances`, `usecase` não `use_cases`).

## 4. Modos de transporte (kafka vs http)

O serviço suporta **dois modos** controlados por `TRANSPORT_MODE`:

| Modo | Inbound (entrada) | Outbound (saída de eventos) | Quando usar |
| --- | --- | --- | --- |
| `kafka` | `wpp.cmd.*.v1` | `wpp.evt.*.v1` (via `kafkasink`) | Stack TriadeMind (gateway) |
| `http` | `POST /v1/instances`, `/v1/messages/text`, `/v1/instances/reconnect`, `DELETE /v1/instances/:id` | Webhook `POST <WEBHOOK_URL>` com HMAC | **Integração com `condosync-api`** |

> **Cenário atual no monorepo CondoSync:** `TRANSPORT_MODE=http`. O backend Nest envia comandos via HTTP autenticado por API key e recebe eventos via webhook assinado com HMAC SHA256 (`x-signature: sha256=...`).

Independente do modo, **TODA saída de evento passa pelo outbox** (`outbox.Publisher` → tabela `message_server.outbox` → `outbox.Relay` consome e entrega via `Sink` apropriado). Isso garante exactly-once lógico mesmo se o webhook estiver fora do ar.

## 5. Fluxos de dados

### 5.1 Comando entrante (modo HTTP)
```
[backend Nest] -- POST /v1/instances + Bearer <API_KEY> -->
       inbound/http/commands_handler.CreateInstance()
              |
              v
       application/usecase.CreateInstance.Execute
              |
              +--> tx.Run(ctx, fn): {
              |       repo.FindByCompany (port domain/instance.Repository)
              |       repo.Create
              |       outbox.Publisher.PublishInstanceCreated  <-- mesma tx
              |     }
              +--> driver.Connect (port domain/instance.Driver)  <-- fora da tx
              v
       HTTP 201 { "instance_id": "..." }
```

### 5.2 Evento espontâneo do WhatsApp
```
[WhatsApp servers] --whatsmeow event--> outbound/whatsmeow/Driver
                                              |
                                              v
                                outbox.Publisher.PublishMessageReceived
                                              |
                                              v
                            tabela message_server.outbox (insert)
                                              |
                                outbox.Relay (goroutine) drena em loop
                                              |
                                              v
                            webhooksink.Publisher (POST + HMAC)  ou  kafkasink
                                              |
                                              v
                                          [backend Nest]
```

### 5.3 Reconnect (caso de uso)
Quando uma instância está em `PENDING` e o serviço reinicia, `RecoverSessions` ignora (sem JID). Para forçar nova sessão WhatsApp e novo QR, use:

```
POST /v1/instances/reconnect { "company_id": "..." }
       |
       v
ReconnectInstance.Execute:
  - repo.FindByID OR repo.FindByCompany
  - driver.Disconnect (best effort)
  - driver.Connect
       |
       v
HTTP 200 { "instance_id": "..." }
```

## 6. Convenções de nomenclatura

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Pacote | minúsculo, singular, sem underscore | `instance`, `usecase`, `inboundhttp` |
| Arquivo | `snake_case.go` | `create_instance.go` |
| Tipo exportado | `PascalCase` | `Instance`, `Repository` |
| Construtor | `New<Tipo>` | `NewCreateInstance` |
| Comando | `<Verbo><Substantivo>Command` | `CreateInstanceCommand` |
| Output | `<Verbo><Substantivo>Output` | `CreateInstanceOutput` |
| Erro de domínio | `*errs.Error` com `Code` em `SCREAMING_SNAKE_CASE` | `INSTANCE_NOT_FOUND` |
| Tópico Kafka | `wpp.{cmd|evt}.{aggr}.{action}.v{N}` | `wpp.cmd.message.send-text.v1` |
| Endpoint HTTP | `kebab-case` | `POST /v1/instances/reconnect` |
| Migration | `<NNNNNN>_<nome>.up.sql` / `.down.sql` | `000002_whatsmeow.up.sql` |

**ASCII-only obrigatório** em código e testes. Comentários em PT-BR sem acentos:
```bash
grep -RPn "[^\x00-\x7F]" internal/   # deve retornar vazio
```

## 7. Padrões de implementação

### Use Case
```go
package usecase

type CreateInstanceCommand struct {
    CompanyID string
    Name      string
}

type CreateInstanceOutput struct {
    InstanceID string
}

type CreateInstance struct {
    tx        ports.TxRunner
    repo      instance.Repository   // port do dominio
    driver    instance.Driver       // port do dominio
    publisher ports.EventPublisher  // port transversal
}

func NewCreateInstance(
    txRunner ports.TxRunner,
    repo instance.Repository,
    driver instance.Driver,
    publisher ports.EventPublisher,
) *CreateInstance {
    return &CreateInstance{tx: txRunner, repo: repo, driver: driver, publisher: publisher}
}

func (uc *CreateInstance) Execute(ctx context.Context, cmd CreateInstanceCommand) (CreateInstanceOutput, error) {
    inst, err := instance.New(cmd.CompanyID, cmd.Name)  // invariantes no construtor do dominio
    if err != nil {
        return CreateInstanceOutput{}, err
    }

    // Mutacao de estado + insert no outbox: na MESMA tx.
    if err := uc.tx.Run(ctx, func(ctx context.Context) error {
        if existing, _ := uc.repo.FindByCompany(ctx, cmd.CompanyID); existing != nil {
            return errs.New(errs.KindConflict, "INSTANCE_ALREADY_EXISTS", "empresa ja possui instancia ativa")
        }
        if err := uc.repo.Create(ctx, inst); err != nil {
            return errs.Wrap(errs.KindInternal, "INSTANCE_PERSIST_FAILED", "falha ao persistir instancia", err)
        }
        pctx := events.WithTenantID(ctx, inst.CompanyID())
        return uc.publisher.PublishInstanceCreated(pctx, events.InstanceCreatedEvent{...})
    }); err != nil {
        var domainErr *errs.Error
        if errors.As(err, &domainErr) { return CreateInstanceOutput{}, domainErr }
        return CreateInstanceOutput{}, errs.Wrap(errs.KindInternal, "CREATE_INSTANCE_TX_FAILED", "transacao falhou", err)
    }

    // Efeito externo (handshake whatsmeow): FORA da tx para nao segurar conexao.
    if err := uc.driver.Connect(ctx, inst); err != nil {
        return CreateInstanceOutput{}, errs.Wrap(errs.KindUnavailable, "INSTANCE_CONNECT_FAILED", "falha ao iniciar sessao", err)
    }
    return CreateInstanceOutput{InstanceID: inst.ID()}, nil
}
```

Pontos obrigatórios:
- **1 arquivo por caso de uso** (`create_instance.go`).
- Struct `Verbo + Substantivo` (`CreateInstance`), construtor `New...`, método único `Execute(ctx, cmd) (out, error)`.
- Comandos de **escrita** = sufixo `Command`. Entradas de **leitura** = sufixo `Input`.
- Não importa `kafka.*`, `pgx.*`, `whatsmeow.*` — apenas ports.
- **Mutação de estado + outbox sempre na mesma transação.**
- **Efeitos externos (whatsmeow.Connect, HTTP)** sempre **fora** da transação.

### Ports
- Ports do **domínio** (Repository, Driver) ficam **junto da entidade** em `internal/domain/<aggregate>/`.
- Ports **transversais** (EventPublisher, TxRunner) ficam em `internal/application/ports/`.
- Nome do port = substantivo singular: `Repository`, `Driver`, `EventPublisher`. **Sem prefixo `I`**.

### Adapters
- Cada adapter implementa **exatamente um** port.
- Localização por direção:
  - **inbound** → `adapter/inbound/<tech>/`
  - **outbound** → `adapter/outbound/<tech>/`
- Pacote = `<tech>` ou `<direcao><tech>` se houver colisão (`inboundkafka`, `outboundkafka`).

### Construtores
- Toda dependência via construtor (`New...`). **Sem variáveis globais**, sem service locator.
- Construtores devolvem `*Type` ou `(*Type, error)`. Sem `panic` em construção a menos que seja invariante de programação.

### Context
- TODA função pública que faz I/O recebe `context.Context` como primeiro parâmetro.
- **Nunca** armazene `context.Context` em struct. Sempre propague.

## 8. Tratamento de erros (`errs.Error`)

```go
// shared/errs/errs.go
const (
    KindValidation   Kind = "VALIDATION"
    KindNotFound     Kind = "NOT_FOUND"
    KindConflict     Kind = "CONFLICT"
    KindUnauthorized Kind = "UNAUTHORIZED"
    KindForbidden    Kind = "FORBIDDEN"
    KindUnavailable  Kind = "UNAVAILABLE"
    KindInternal     Kind = "INTERNAL"
)
```

Regras:
- Erros de **negócio** → `errs.New(Kind, "CODE_SCREAMING", "mensagem em pt-BR sem acentos")`.
- Erros de **infra** → `fmt.Errorf("camada: contexto: %w", err)` quando saindo do adapter; `errs.Wrap(Kind, Code, Msg, err)` quando o caso de uso já consegue classificar.
- Adapters **inbound** traduzem `errs.Kind` para o resultado apropriado:
  - HTTP: `KindValidation`/`KindNotFound`/`KindConflict` → 400/404/409. `KindUnavailable`/`KindInternal` → 502/500.
  - Kafka: `KindValidation`/`KindNotFound`/`KindConflict` → NACK + DLQ. `KindUnavailable`/`KindInternal` → erro retornado para reentrega.
- **Nunca** engolir erro com `_ =` (exceto operações best-effort com comentário explícito).
- **Nunca** `panic` em fluxo normal. `panic` só para invariantes de programação (switch enum exaustivo, etc.).

## 9. Persistência (Postgres + whatsmeow)

- Pool `pgxpool.Pool` em `internal/platform/postgres/postgres.go`. Ping fail-fast no boot (5s).
- Interface `Querier` em `internal/platform/postgres/querier.go` é satisfeita por `*pgxpool.Pool` E `pgx.Tx`. Repositórios participam de transação externa **sem mudar assinatura**.
- Migrations em SQL puro, versionadas, em `migrations/`. Aplicadas no boot por `internal/platform/postgres/migrate.Run` usando `golang-migrate` com **advisory lock** do Postgres (multi-replica safe). **Forward-only em prod**; `make migrate-down` apenas em dev.
- Schemas dedicados:
  - `message_server` (app) → tabelas `instances`, `messages`, `outbox`, `inbox`.
  - `whatsmeow` (sqlstore da lib whatsmeow) → controlado por `WHATSMEOW_DB_SCHEMA`.
- Repos Postgres em `internal/adapter/outbound/postgres/`:
  - `InstanceRepository` (port `instance.Repository`).
  - `MessageRepository` (port `message.Repository`, `Save` idempotente via `ON CONFLICT (instance_id, wpp_id, direction) DO NOTHING`).
- Mapeamento canônico de erros em `internal/adapter/outbound/postgres/errors.go` (`mapError`):
  - `pgerrcode.UniqueViolation` → `errs.KindConflict`
  - `pgerrcode.ForeignKeyViolation` → `errs.KindNotFound`
  - `pgerrcode.CheckViolation` / `NotNullViolation` → `errs.KindValidation`
  - `pgx.ErrNoRows` em `FindBy*` → `(nil, nil)`
  - `pgx.ErrNoRows` em `Update*`/`Delete*` → `errs.KindNotFound`
  - default → `errs.KindInternal` (preserva `%w`)
- `memoryrepo/` é APENAS para testes — **NÃO usar em bootstrap**.

## 10. Confiabilidade — outbox/inbox

Três componentes cooperativos garantem entrega exactly-once lógica:

1. **Transactional Outbox** (`outbox/publisher.go`):
   - Implementa `ports.EventPublisher`.
   - Cada `Publish*` insere registro em `message_server.outbox` usando o `Querier` recuperado de `txctx.From(ctx, pool)`.
   - Quando o caso de uso roda dentro de `tx.Manager.RunInTx`, o insert participa da MESMA transação da mutação de estado — **estado e evento nunca divergem**.

2. **Outbox Relay** (`outbox/relay.go`):
   - Goroutine de longa vida iniciada no `bootstrap`.
   - Loop: `SELECT ... FOR UPDATE SKIP LOCKED` (multi-replica safe), produz no `Sink` (kafkasink ou webhooksink), marca `published_at = now()`.
   - Em falha incrementa `attempts` + `last_error`; backoff exponencial (cap 5min).
   - Configuração: `OUTBOX_BATCH_SIZE`, `OUTBOX_POLL_INTERVAL`.

3. **Inbox + IdempotentHandler** (`outbox/inbox_recorder.go` + `inbound/kafka/idempotent.go`):
   - Garantem exactly-once **lógico** no consumer Kafka.
   - Cada handler envolto em tx que tenta `INSERT INTO message_server.inbox(event_id, topic) ON CONFLICT DO NOTHING`. Conflito = duplicata = handler interno **NÃO** chamado.

Ao adicionar novo evento publicável:
1. Adicione um método `Publish<X>` ao port `ports.EventPublisher`.
2. Implemente em `outbox.Publisher` (insert na tabela outbox com payload serializado).
3. Adicione mapeamento de tópico em `outbox.Relay` (qual sink/topic usar para esse `event_type`).
4. Atualize o cliente (backend Nest) para tratar o novo `event_type` no webhook handler.

## 11. Configuração

`internal/config/config.go` é o **único** lugar autorizado a chamar `os.Getenv`. Padrão para nova variável:
1. Acrescente campo na struct `Config`.
2. Leia em `Load()` com default razoável para `local`.
3. Em `prod`, variáveis críticas são **explícitas** (sem fallback silencioso).
4. Sincronize `.env.example` com a struct (toda variável documentada).
5. Atualize `secrets/` (apenas placeholders) e `docker-compose.yml` se relevante.

Variáveis-chave atuais (vide `.env.example`):
- `APP_ENV`, `APP_NAME`, `LOG_LEVEL`, `HTTP_PORT`, `HTTP_API_KEY`, `SHUTDOWN_TIMEOUT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`, `DB_MAX_CONNS`, `MIGRATIONS_DIR`
- `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_CONSUMER_GROUP`, `KAFKA_TOPIC_*`
- `TRANSPORT_MODE` (`kafka` | `http`)
- `WEBHOOK_URL`, `WEBHOOK_AUTH_TOKEN`, `WEBHOOK_SECRET`, `WEBHOOK_TIMEOUT`
- `OUTBOX_BATCH_SIZE`, `OUTBOX_POLL_INTERVAL`
- `WHATSMEOW_LOG_LEVEL`, `WHATSMEOW_DB_SCHEMA`
- `METRICS_PORT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`

## 12. Logging, métricas, tracing

### Logger
- Usar **somente** `internal/platform/logger.Logger` (wrap em `slog`).
- JSON estruturado, sempre. **Nunca** `fmt.Println`.
- Campos automáticos: `service`, `env`, `time`, `level`, `msg`.
- Cada log de erro inclui `"err", err.Error()` como atributo.
- **Não logue PII em `info`** (números de telefone parcializados; em `debug` ok).

### Métricas (Prometheus)
- `internal/platform/metrics` expõe um registry **isolado** (não usa `DefaultRegisterer`).
- Namespace: `messageserver`. Servidor `/metrics` em porta dedicada (`METRICS_PORT`, default 9090).
- Adapters fazem instrumentação. **`application/` NÃO importa `platform/metrics`.**
- Instrumentos atuais: `kafka_consumer_lag{topic,partition}`, `kafka_handler_duration_seconds{topic,outcome}`, `outbox_pending`, `outbox_published_total{topic}`, `outbox_failed_total{topic,reason}`, `whatsmeow_sessions{status}`, `incoming_messages_total{instance_id,kind}`, `outgoing_messages_total{instance_id,kind,outcome}`.

### Tracing (OpenTelemetry)
- `internal/platform/tracing` instala propagator W3C TraceContext **sempre** (mesmo em modo noop).
- Se `OTEL_EXPORTER_OTLP_ENDPOINT` vazio → tracer provider noop. Caso contrário → `otlptracegrpc` com `BatchSpanProcessor`.
- `traceparent` é injetado no envelope/headers pelo outbox publisher e extraído pelo idempotent handler — spans cruzam Kafka sem acoplamento dos casos de uso.

### Healthchecks
- `/health/live` sempre 200 (liveness K8s).
- `/health/ready` faz `pool.Ping` com timeout 2s; 503 quando DB indisponível.

## 13. Testes

- **Unit tests** em `_test.go` ao lado do código. Cobrem `domain/` e `application/` SEM dependências externas.
- Pacote externo `_test` preferido para casos de uso e adapters (testa apenas API pública).
- **Integration tests** em `tests/integration/` usando `testcontainers-go` para Kafka + Postgres reais.
- **Cobertura mínima** para PR ser aceito: 80% em `domain/` e `application/`. Adapters cobertos por integration tests.
- **Stdlib only**: testes não importam `testify`, `gomock` ou similares — table-driven + fakes manuais.
- Logger silencioso em testes via `logger.NewWithWriter("error", io.Discard)`.
- **Fakes compartilhados** em `fakes_test.go` no mesmo pacote (ex.: `internal/application/usecase/fakes_test.go`).
- **Race detector obrigatório**: `go test -race -count=1 ./...` deve passar verde antes de qualquer push. `count=1` desabilita cache.

Padrão table-driven:
```go
func TestCreateInstance_Execute(t *testing.T) {
    tests := []struct{
        name    string
        cmd     CreateInstanceCommand
        wantErr errs.Kind
    }{
        {"happy path", CreateInstanceCommand{CompanyID: "c1", Name: "n1"}, ""},
        {"missing company", CreateInstanceCommand{Name: "n1"}, errs.KindValidation},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) { /* ... */ })
    }
}
```

## 14. Build, lint, Docker

```bash
# dentro de message-server-main/
make fmt vet test     # antes de commit
make build            # binário em ./bin/server
make run              # roda local com .env
go test -race -count=1 ./...   # full check
```

`golangci-lint` configurado com: `errcheck`, `gosimple`, `govet`, `staticcheck`, `revive`, `gosec`, `bodyclose`, `errorlint`.

CI (GitHub Actions): `tidy diff`, `vet`, `lint`, `test -race`, `build`.

Docker:
```bash
# da raiz do monorepo
docker compose build message-server
docker compose up -d message-server
docker logs condosync-message-server --tail=80 -f
```

Imagens publicadas com tag `vMAJOR.MINOR.PATCH` + `git-sha`. Container final: distroless nonroot.

## 15. Como adicionar um caso de uso novo (checklist)

Suponha "marcar instância como bloqueada".

1. **Domain:** adicione método na entity (`instance.MarkBlocked()`) + `Status` novo se preciso. Validações em `instance.go`.
2. **Port (se faltar):** se o repo precisa de `UpdateStatus`, adicione no port `instance.Repository`.
3. **Use case:** crie `internal/application/usecase/block_instance.go` seguindo o padrão (`BlockInstanceCommand`, `BlockInstance` struct, `NewBlockInstance`, `Execute`).
4. **Event (se publicar):** adicione `events.InstanceBlockedEvent` em `internal/application/events/` e método `PublishInstanceBlocked` no port `ports.EventPublisher`. Implemente em `outbox.Publisher` + roteamento em `outbox.Relay`.
5. **Adapter inbound:**
   - HTTP: novo handler em `inbound/http/commands_handler.go` + rota em `bootstrap/app.go` (`mux.HandleFunc("/v1/instances/block", method(http.MethodPost, commands.BlockInstance()))`).
   - Kafka: novo `KAFKA_TOPIC_CMD_INSTANCE_BLOCK=wpp.cmd.instance.block.v1` + handler no router.
6. **Repo Postgres:** se método novo (`UpdateStatus`), implemente em `adapter/outbound/postgres/` mapeando erro com `mapError`.
7. **Bootstrap:** instancie o use case e injete no Commands handler / router Kafka.
8. **Migration:** se mudou schema, crie `migrations/000003_<nome>.up.sql` + `.down.sql`.
9. **Tests:** crie `block_instance_test.go` (table-driven, fakes manuais).
10. **`.env.example`:** atualize se introduziu nova variável.
11. **Validate:** `make fmt vet test && go test -race -count=1 ./...`.

## 16. Anti-padrões — recusar em code review

- ❌ `fmt.Println` ou `log.Print*` em produção. Use `logger.Logger`.
- ❌ `panic()` em fluxo normal de I/O.
- ❌ `os.Getenv` fora de `internal/config`.
- ❌ `application/` ou `domain/` importando `pgx`, `kafka`, `whatsmeow` ou `prometheus`.
- ❌ Caso de uso usando `*tx.Manager` em vez do port `ports.TxRunner`.
- ❌ Adapter chamando outro adapter diretamente (devem se comunicar via use case).
- ❌ Use case com efeitos externos (`whatsmeow.Connect`, HTTP) **dentro** da transação Postgres.
- ❌ Erro tratado com `_ = err` sem comentário explícito de "best effort".
- ❌ Caracteres não-ASCII em código ou testes (acentos, emojis).
- ❌ `panic` em construtor `New...` (use `(T, error)` quando inicialização pode falhar).
- ❌ Bibliotecas de teste (`testify`, `gomock`).
- ❌ Migration sem `down`. Migration sem `IF NOT EXISTS` quando aplicável.
- ❌ Novo evento publicado sem passar pelo outbox (ex.: chamar Kafka direto do use case).
- ❌ Tópico Kafka sem `.v1` no final.
- ❌ Adicionar dependência sem justificativa (sem documentação no PR).
- ❌ `context.Context` armazenado em campo de struct.

> Se em dúvida sobre estrutura, abra `internal/application/usecase/create_instance.go` — é a referência canônica e está sempre atualizado.
