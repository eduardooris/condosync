# Guia Tecnico - message-server

> Documento normativo. Define arquitetura, padroes de implementacao e
> convencoes de codigo do servico `message-server`.
>
> AVISO INEGOCIAVEL: As regras descritas aqui sao a fonte de verdade do
> projeto. Qualquer divergencia exige justificativa formal em PR. Codigo
> que viole estas regras sem justificativa documentada sera recusado em
> code review.

## Indice

1. [Visao Geral](#1-visao-geral)
2. [Stack](#2-stack)
3. [Arquitetura](#3-arquitetura)
4. [Estrutura de Pastas](#4-estrutura-de-pastas)
5. [Fluxo de Dados](#5-fluxo-de-dados)
6. [Contratos Kafka](#6-contratos-kafka)
7. [Padroes de Implementacao](#7-padroes-de-implementacao)
8. [Convencoes de Nomenclatura](#8-convencoes-de-nomenclatura)
9. [Tratamento de Erros](#9-tratamento-de-erros)
10. [Logging e Observabilidade](#10-logging-e-observabilidade)
11. [Configuracao](#11-configuracao)
12. [Persistencia](#12-persistencia)
13. [Confiabilidade de Eventos](#13-confiabilidade-de-eventos)
14. [Seguranca](#14-seguranca)
15. [Testes](#15-testes)
16. [Build, Lint e CI](#16-build-lint-e-ci)
17. [Versionamento de Contratos](#17-versionamento-de-contratos)

---

## 1. Visao Geral

`message-server` substitui a Evolution API (Node/Baileys) no stack
TriadeMind. Implementa **somente** as capacidades atualmente consumidas
pelo `whatsapp-gateway`:

- criar instancia WhatsApp + emitir QR Code;
- observar transicoes de conexao (open/close);
- receber mensagens entrantes (texto e audio transcrito);
- enviar mensagens de texto.

A integracao com o restante do ecossistema (gateway, llm-server) ocorre
**exclusivamente via Kafka**. NAO existe webhook HTTP de saida; o unico
endpoint HTTP exposto e `/health` para liveness/readiness.

## 2. Stack

| Camada | Escolha | Justificativa |
|--------|---------|---------------|
| Linguagem | Go 1.23 | Performance, baixa RAM, deploy estatico |
| WhatsApp | `go.mau.fi/whatsmeow` | Acesso nativo ao protocolo WhatsApp |
| Mensageria | Kafka via `github.com/twmb/franz-go` | Mesma stack do gateway |
| DB | Postgres via `github.com/jackc/pgx/v5` | Session store whatsmeow + outbox |
| Logger | `log/slog` (stdlib) | Sem dependencia externa |
| Config | `os.Getenv` + `joho/godotenv` (local) | Padrao 12-Factor |
| Identidade | UUID v4 (`google/uuid`) | Compativel com main-api |
| Containerizacao | Distroless | Imagem minima e segura |

**Regra:** novas dependencias exigem justificativa em PR. Preferir stdlib
sempre que possivel. Bibliotecas devem ter manutencao ativa, license
permissiva (Apache-2.0 / MIT / BSD) e ausencia de CGO.

## 3. Arquitetura

Adotamos **Hexagonal Architecture (Ports & Adapters)** com tres camadas:

```
+-----------------------------------------------------------+
|  ADAPTERS (inbound: kafka consumer | outbound: kafka,     |
|           whatsmeow, postgres)                            |
+-----------------------------------------------------------+
|  APPLICATION (use cases + ports)                          |
+-----------------------------------------------------------+
|  DOMAIN (entidades, invariantes, ports do dominio)        |
+-----------------------------------------------------------+
```

Regras inegociaveis:

1. `domain/` NAO pode importar nada de `application/`, `adapter/`,
   `platform/` ou bibliotecas de infraestrutura. Apenas stdlib e
   pacotes internos como `shared/errs`, `shared/id`.
2. `application/` NAO pode importar `adapter/` ou `platform/`. Depende
   somente de `domain/` e dos ports declarados em
   `application/ports/`. Em particular, casos de uso que precisam de
   transacao Postgres dependem do port `ports.TxRunner` -- NUNCA do
   `*tx.Manager` concreto (que vive em `platform/postgres/tx`).
3. Adapters concretos sao instanciados **somente** em `internal/bootstrap`.
   Nenhum outro pacote pode chamar `kafka.New`, `pgxpool.New`, etc.
4. Toda comunicacao entre camadas usa **structs imutaveis** (Command/Input
   na entrada, Output na saida). Nao passar `map[string]any`.
5. Adapters podem declarar **interfaces locais minimas** para receber
   colaboradores em vez de tipos concretos quando isso for necessario
   para testabilidade unitaria (ex.: `IdempotentHandler` e `Router` em
   `adapter/inbound/kafka` recebem `inboxRecorder` / `txRunner` locais
   satisfeitos por `*outbox.Recorder` / `*tx.Manager`). Esta tecnica
   nao expoe novos tipos publicos e mantem o wiring em `bootstrap`
   inalterado.

## 4. Estrutura de Pastas

```
message-server/
├── cmd/
│   └── server/                  # Entrypoint (main.go)
├── internal/
│   ├── bootstrap/               # Wiring de dependencias (unico ponto)
│   ├── config/                  # Carregamento de env vars
│   ├── domain/
│   │   ├── instance/            # Agregado Instance + ports (Repository, Driver)
│   │   └── message/             # Agregado Message
│   ├── application/
│   │   ├── events/              # Contratos Kafka (commands + events)
│   │   ├── ports/               # Output ports transversais (EventPublisher)
│   │   └── usecase/             # Casos de uso (um arquivo por UC)
│   ├── adapter/
│   │   ├── inbound/
│   │   │   └── kafka/           # Roteador Kafka -> use cases
│   │   └── outbound/
│   │       ├── kafka/           # EventPublisher
│   │       ├── memoryrepo/      # Repos in-memory (dev/test)
│   │       └── whatsmeow/       # Driver WhatsApp
│   ├── platform/                # Bibliotecas tecnicas reutilizaveis
│   │   ├── kafka/               # Cliente franz-go (Producer + Consumer)
│   │   └── logger/              # Wrapper slog
│   └── shared/                  # Cross-cutting (sem regras de negocio)
│       ├── errs/                # Tipos de erro de dominio
│       └── id/                  # Geracao/parse de IDs
├── Dockerfile
├── Makefile
├── .env.example
├── go.mod
└── GUIA_TECNICO.md
```

**Regra de nomenclatura de pacotes:** sempre singular e em minusculas,
sem underscores (`instance` nao `instances`, `usecase` nao `use_cases`).

## 5. Fluxo de Dados

### 5.1 Comando entrante (gateway -> message-server)

```
[Gateway] -> Kafka (wpp.cmd.message.send-text.v1)
              |
              v
       inbound/kafka/Router (handleSendTextMessage)
              |
              v
       application/usecase.SendTextMessage.Execute
              |
              +--> instance.Repository.FindByID (port)
              +--> instance.Driver.SendText      (port)
              +--> ports.EventPublisher.PublishMessageSent
                       |
                       v
                Kafka (wpp.evt.message.sent.v1)
                       |
                       v
                   [Gateway]
```

### 5.2 Evento WhatsApp espontaneo (mensagem recebida)

```
[WhatsApp servers] --whatsmeow event--> outbound/whatsmeow/Driver
                                              |
                                              v
                                ports.EventPublisher.PublishMessageReceived
                                              |
                                              v
                                Kafka (wpp.evt.message.received.v1)
                                              |
                                              v
                                          [Gateway]
```

## 6. Contratos Kafka

### 6.1 Convencao de nomes de topicos

`wpp.{cmd|evt}.{aggregate}.{action}.v{N}`

- `wpp.cmd.*` - comandos consumidos pela message-server.
- `wpp.evt.*` - eventos publicados pela message-server.
- `vN` - versao MAJOR. Mudancas breaking exigem novo topico (`v2`).

### 6.2 Envelope

**Toda** mensagem trafega dentro de `events.EventEnvelope[T]`:

```json
{
  "event_id": "uuid",
  "event_type": "message.received",
  "event_version": "1.0",
  "occurred_at": "2026-04-23T13:00:00Z",
  "correlation_id": "uuid (opcional)",
  "source": "message-server",
  "payload": { ... }
}
```

### 6.3 Topicos atuais (v1)

| Direcao | Topico | Payload |
|---------|--------|---------|
| in | `wpp.cmd.instance.create.v1` | `CreateInstanceCommand` |
| in | `wpp.cmd.instance.delete.v1` | `DeleteInstanceCommand` |
| in | `wpp.cmd.message.send-text.v1` | `SendTextMessageCommand` |
| out | `wpp.evt.instance.qrcode.v1` | `QRCodeUpdatedEvent` |
| out | `wpp.evt.instance.connection.v1` | `ConnectionUpdatedEvent` |
| out | `wpp.evt.message.received.v1` | `MessageReceivedEvent` |
| out | `wpp.evt.message.sent.v1` | `MessageSentEvent` |

### 6.4 Garantias

- **At-least-once.** Consumidores devem ser idempotentes (chave =
  `event_id` ou `wpp_id`).
- **Particionamento por `instance_id`** (key do record) para preservar
  ordenacao por instancia.
- Auto-commit DESABILITADO; commit so apos handler retornar `nil`.

## 7. Padroes de Implementacao

### 7.1 Use Cases

- Um arquivo por caso de uso, nome `verbo_substantivo.go`
  (`create_instance.go`).
- Struct com sufixo de acao (`CreateInstance`), funcao construtora
  `NewCreateInstance`, metodo `Execute(ctx, cmd) (out, error)`.
- Comandos de **escrita** = `*Command`; entradas de **leitura** = `*Input`.
- Use Cases **nao** dependem de `kafka.*`, `pgx.*`, `whatsmeow.*`. Apenas
  ports.

### 7.2 Ports

- Ports de dominio (Repository, Driver) ficam **junto da entidade** em
  `internal/domain/{aggregate}/`.
- Ports transversais (EventPublisher) ficam em `internal/application/ports/`.
- Nome do port = substantivo no singular (`Repository`, `Driver`,
  `EventPublisher`). Sem prefixo `I`.

### 7.3 Adapters

- Cada adapter implementa exatamente um port.
- Localizacao por direcao:
  - **inbound** (driven by external event) -> `adapter/inbound/{tech}/`
  - **outbound** (driving an external system) -> `adapter/outbound/{tech}/`
- Nome do pacote = `{direcao}{tech}` quando houver colisao
  (ex.: `inboundkafka`, `outboundkafka`).

### 7.4 Construtores

- Toda dependencia via construtor (`New...`). Nao usar variaveis
  globais nem service locator.
- Construtores devolvem `*Type` ou `(Type, error)`. Sem panic em
  construcao a menos que seja uma falha de programacao.

### 7.5 Context

- TODA funcao publica que faz I/O recebe `context.Context` como primeiro
  parametro.
- Nunca armazenar `context.Context` em struct. Sempre propagar.

## 8. Convencoes de Nomenclatura

| Item | Convencao | Exemplo |
|------|-----------|---------|
| Pacote | minusculo, singular | `instance`, `usecase` |
| Arquivo | snake_case | `create_instance.go` |
| Tipo exportado | PascalCase | `Instance`, `Repository` |
| Constructor | `New<Tipo>` | `NewCreateInstance` |
| Erro de dominio | `*errs.Error` com `Code` em SCREAMING_SNAKE_CASE | `INSTANCE_NOT_FOUND` |
| Topico Kafka | `wpp.{cmd|evt}.{aggr}.{action}.v{N}` | `wpp.cmd.message.send-text.v1` |

## 9. Tratamento de Erros

- Erros de **negocio** -> `internal/shared/errs.New(Kind, Code, Msg)`.
- Erros de **infra** -> `fmt.Errorf("camada: contexto: %w", err)`.
- Adapters (inbound) traduzem `errs.Kind` para o resultado apropriado:
  - `KindValidation` / `KindNotFound` / `KindConflict` -> NACK + DLQ
    (mensagem mal formada nao deve ser reentregue infinitamente);
  - `KindUnavailable` / `KindInternal` -> erro retornado para reentrega.
- **Nunca** engolir erro com `_ =` (exceto operacoes best-effort
  explicitamente comentadas).
- **Nunca** usar `panic` em fluxo normal. `panic` reservado para
  invariantes de programacao (ex.: switch enum exaustivo).

## 10. Logging e Observabilidade

- Usar **somente** `internal/platform/logger.Logger`.
- Logs sao **JSON estruturado**, sempre. Nada de `fmt.Println`.
- Campos minimos automaticos: `service`, `env`, `time`, `level`, `msg`.
- Cada log de erro deve incluir o erro como atributo: `"err", err.Error()`.
- Nao logar PII em nivel `info` (numeros de telefone parcializados).
- **Metricas (G4):** `internal/platform/metrics` expoe um registry
  Prometheus isolado (nao usa `DefaultRegisterer`). Namespace
  `messageserver`. Instrumentos: `kafka_consumer_lag{topic,partition}`,
  `kafka_handler_duration_seconds{topic,outcome}`, `outbox_pending`,
  `outbox_published_total{topic}`, `outbox_failed_total{topic,reason}`,
  `whatsmeow_sessions{status}`, `incoming_messages_total{instance_id,kind}`,
  `outgoing_messages_total{instance_id,kind,outcome}`. Adapters fazem a
  instrumentacao (idempotent handler, outbox publisher/relay, dispatcher,
  router) -- `application/` **nao** importa `platform/metrics`.
- **Tracing (G4):** `internal/platform/tracing` instala propagator W3C
  TraceContext sempre (mesmo em modo noop). Se `OTEL_EXPORTER_OTLP_ENDPOINT`
  for vazio, o tracer provider e noop; caso contrario usa `otlptracegrpc`
  com `BatchSpanProcessor`. `traceparent` e injetado no envelope/headers
  pelo outbox publisher e extraido pelo idempotent handler -- spans
  cruzam limites Kafka sem acoplamento dos casos de uso.
- **Healthchecks:** split `live` vs `ready` em
  `internal/adapter/inbound/http`. `/health/live` sempre 200 (liveness
  K8s). `/health/ready` faz `pool.Ping` com 2s de timeout (readiness).
- **Servidor Prometheus dedicado:** `/metrics` exposto em porta
  separada (`METRICS_PORT`, default 9090) para isolar observabilidade do
  trafego de aplicacao.

## 11. Configuracao

- Toda configuracao via **env vars**. `internal/config` e o unico ponto
  autorizado a chamar `os.Getenv`.
- Defaults razoaveis para `local`; em `prod` toda variavel critica deve
  ser **explicita** (sem fallback silencioso).
- `.env.example` deve ser mantido sincronizado com `Config`.

## 12. Persistencia

A persistencia oficial em producao e Postgres (entregue em G1):

- Pool `pgxpool.Pool` em `internal/platform/postgres/postgres.go`.
  Construtor unico `New(ctx, cfg, log)`. Ping fail-fast no boot (5s).
- Interface `Querier` em `internal/platform/postgres/querier.go`
  satisfeita por `*pgxpool.Pool` E `pgx.Tx` -- repositorios participam
  de transacao externa (outbox em G2) sem refactor de assinatura.
- Migrations em SQL puro, versionadas, em `migrations/`. Aplicadas no
  boot por `internal/platform/postgres/migrate.Run` usando
  `golang-migrate` com advisory lock do Postgres (multi-replica safe).
  Forward-only em prod; `make migrate-down` apenas em dev.
- Schemas dedicados:
  - `message_server` (app) -- tabelas `instances`, `messages`, `outbox`,
    `inbox`;
  - `whatsmeow` (reservado para G3, sqlstore da lib).
- Repos Postgres em `internal/adapter/outbound/postgres/`:
  - `InstanceRepository` (port `instance.Repository`);
  - `MessageRepository` (port `message.Repository`, `Save` idempotente
    via `ON CONFLICT (instance_id, wpp_id, direction) DO NOTHING`).
- Mapeamento canonico de erros em
  `internal/adapter/outbound/postgres/errors.go` (`mapError`):
  - `pgerrcode.UniqueViolation`        -> `errs.KindConflict`;
  - `pgerrcode.ForeignKeyViolation`    -> `errs.KindNotFound`;
  - `pgerrcode.CheckViolation` /
    `pgerrcode.NotNullViolation`        -> `errs.KindValidation`;
  - `pgx.ErrNoRows` em `FindBy*`       -> `(nil, nil)`;
  - `pgx.ErrNoRows` em `Update*`/`Delete*` -> `errs.KindNotFound`;
  - default                            -> `errs.KindInternal` (preserva `%w`).
- `internal/adapter/outbound/memoryrepo/` permanece em codigo apenas
  para uso em testes unitarios (NAO usar em bootstrap).
- `/health` faz `pool.Ping` com timeout de 2s e responde 503 quando
  o banco estiver indisponivel.
- Whatsmeow `sqlstore` consumira o mesmo cluster em G3, no schema
  dedicado `whatsmeow`.

## 13. Confiabilidade de Eventos

A camada de confiabilidade foi entregue em G2 e e composta por tres
elementos cooperativos:

- **Transactional Outbox** (`internal/adapter/outbound/outbox/publisher.go`)
  implementa `ports.EventPublisher`. Cada `Publish*` insere um registro
  na tabela `message_server.outbox` usando o `Querier` recuperado de
  `txctx.From(ctx, pool)`. Quando o caso de uso esta dentro de
  `tx.Manager.RunInTx`, o insert participa da MESMA transacao da
  mutacao de estado -- evento e estado nunca divergem.
- **Outbox Relay** (`internal/adapter/outbound/outbox/relay.go`) e uma
  goroutine de longa vida iniciada pelo `bootstrap` que executa em loop:
  `SELECT ... FOR UPDATE SKIP LOCKED` (multi-replica safe), produz no
  `kafkasink.Sink`, marca `published_at = now()`. Em falha incrementa
  `attempts` + `last_error` e retentativa segue backoff exponencial
  (cap 5min). Configuracao via `OUTBOX_BATCH_SIZE` e
  `OUTBOX_POLL_INTERVAL`.
- **Inbox + IdempotentHandler**
  (`internal/adapter/outbound/outbox/inbox_recorder.go` +
  `internal/adapter/inbound/kafka/idempotent.go`) garantem exactly-once
  logico no consumer: cada handler e envolvido em uma tx que tenta
  `INSERT INTO message_server.inbox(event_id, topic) ON CONFLICT DO
  NOTHING`; conflito = duplicata = handler interno NAO e chamado.

Contratos auxiliares:

- `EventEnvelope.EventID` e obrigatorio (preenchido pelo `outbox.Publisher`)
  e propagado como header Kafka `event_id` pelo relay.
- `EventEnvelope.TraceParent` e opcional, reservado para o tracing
  W3C que entra em G4.
- `tx.Manager.RunInTx` detecta tx pre-existente em `ctx` e reutiliza
  (sem aninhamento real) -- compativel com o decorator do consumer
  envolvendo um caso de uso que tambem chama `RunInTx`.
- `tx.Manager.Run(ctx, fn)` e o atalho que satisfaz `ports.TxRunner`
  (delegacao a `RunInTx` com `pgx.TxOptions{}` defaults). E o unico
  ponto de entrada usado pelos casos de uso, mantendo `application/`
  livre de imports de `pgx`.

Metricas internas (G4 expoe via Prometheus):
`outbox_pending`, `outbox_published_total`, `outbox_failed_total`
(via `expvar`).

## 14. Seguranca

- Imagem final **distroless nonroot** (ja configurada).
- Secrets via env vars / Docker secrets - nunca no codigo nem no repo.
- Conexoes Kafka/Postgres em producao **devem** usar TLS.
- Validacao em todas as bordas: `usecase` valida entrada antes de chamar
  ports; `domain.New*` aplica invariantes.
- Nao confiar em payloads externos: sempre `Unmarshal` em struct tipada.

## 15. Testes

Estrutura:

- **Unit tests** em `_test.go` ao lado do codigo. Cobrem `domain` e
  `application` SEM dependencias externas. Pacote externo `_test`
  preferido para casos de uso e adapters (testa apenas a API publica).
- **Integration tests** em `tests/integration/` usando `testcontainers-go`
  para Kafka + Postgres reais (entregavel de G4).
- **Cobertura minima** para PR ser aceito: 80% em `domain` e
  `application`. Adapters tem cobertura via integration tests.
  Estado em 0.3.0: `application/usecase` em **97.3%** statements.
- **Stdlib only**: testes nao podem importar `testify`, `gomock` ou
  similares -- usar table-driven + fakes manuais. Logger silencioso em
  testes via `logger.NewWithWriter("error", io.Discard)`.
- **Fakes em `_test.go` compartilhado**: quando varios testes do mesmo
  pacote precisam dos mesmos dubles, declare-os em um arquivo
  `fakes_test.go` (ex.: `internal/application/usecase/fakes_test.go`).
- **Testabilidade dirige design**: codigo que so e testavel com DB real
  e suspeito. Antes de adiar para integration suite, considere extrair
  uma interface local no adapter (vide regra 3.5).
- **Race detector obrigatorio**: `go test -race -count=1 ./...` deve
  passar verde antes de qualquer push. `count=1` desabilita cache.
- **ASCII-only** em codigo e testes (`grep -RPn "[^\x00-\x7F]" internal/`
  deve retornar vazio). Comentarios em PT-BR sem acentos.

Padrao de teste (table-driven):

```go
func TestCreateInstance_Execute(t *testing.T) {
    tests := []struct{
        name    string
        cmd     CreateInstanceCommand
        wantErr errs.Kind
    }{
        {"happy path", CreateInstanceCommand{...}, ""},
        {"missing company", CreateInstanceCommand{...}, errs.KindValidation},
    }
    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) { ... })
    }
}
```

## 16. Build, Lint e CI

- `make fmt vet test` deve rodar verde antes de commit.
- `golangci-lint` configurado com `errcheck`, `gosimple`, `govet`,
  `staticcheck`, `revive`, `gosec`, `bodyclose`, `errorlint`.
- CI (GitHub Actions) executa: `tidy diff`, `vet`, `lint`, `test -race`,
  `build`.
- Imagens publicadas com tag `vMAJOR.MINOR.PATCH` + `git-sha`.

## 17. Versionamento de Contratos

- `event_version` no envelope segue SemVer (`MAJOR.MINOR`).
- Mudanca **MINOR** (campo opcional adicional) -> mesma versao de topico.
- Mudanca **MAJOR** (renomeacao, remocao, mudanca de tipo) -> novo
  topico com sufixo `.v{N+1}`. A versao antiga permanece ativa por no
  minimo um sprint.
- Quebra de contrato sem migracao gradual e PROIBIDA.
