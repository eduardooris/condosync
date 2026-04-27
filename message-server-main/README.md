# message-server

Servidor WhatsApp da TriadeMind. Substitui a Evolution API (Node/Baileys)
expondo somente as capacidades realmente usadas pelo `whatsapp-gateway`,
com integracao **100% via Kafka** (sem webhooks).

## Documentacao

- Arquitetura, padroes, regras inegociaveis: ver
  [GUIA_TECNICO.md](GUIA_TECNICO.md).
- Variaveis de ambiente: ver [.env.example](.env.example).

## Quickstart (dev)

```bash
cp .env.example .env
# Suba um Postgres local (ex.: docker run --rm -p 5432:5432 \
#   -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wpp_message_server postgres:16)
make tidy
make migrate-up   # opcional: o boot tambem aplica migrations
make run
```

O boot:

1. abre o pool `pgxpool` (fail-fast em 5s se o banco estiver indisponivel);
2. aplica migrations pendentes via `golang-migrate` (advisory lock --
   multi-replica safe);
3. registra handlers Kafka e expoe `/health`.

Endpoints:

- `GET /health` - liveness + readiness (faz `pool.Ping`; 503 se DB down).

Migrations:

- `make migrate-up`     -- aplica todas as pendentes.
- `make migrate-down`   -- reverte a ultima (apenas dev).
- `make migrate-create NAME=add_foo` -- cria nova versao (`-seq`).
- `make migrate-version` -- mostra versao corrente.

## Status desta entrega

**0.5.0 - G4 Observability + Integration Tests entregue.**

Incluso (cumulativo desde 0.1.0):

- estrutura Hexagonal completa (domain / application / adapters / platform);
- config, logger (slog JSON), errs, ids;
- agregados `instance` e `message` com ports `Repository` e `Driver`;
- contratos Kafka (`EventEnvelope`, commands, events);
- casos de uso `CreateInstance`, `SendTextMessage`;
- adapters Kafka (in/out) e `whatsmeow` em STUB (G3);
- **G1**: pool `pgxpool` + interface `Querier`; migrations baseline
  (`instances`, `messages`, `outbox`, `inbox`) em schema dedicado
  `message_server`; runner `migrate.Run` com advisory lock; repos
  Postgres concretos para `Instance` e `Message`; mapeador canonico
  de erros pgx -> `errs.Kind`; `/health` com `pool.Ping`; targets
  `make migrate-*`.
- **G2**: Transactional Outbox (`outbox.Publisher` injetado como
  `ports.EventPublisher`) + Outbox Relay (goroutine com
  `SELECT ... FOR UPDATE SKIP LOCKED`, backoff exponencial, metricas
  `expvar`) + Inbox decorator (`IdempotentHandler` envolve todo handler
  Kafka inbound). `tx.Manager` com reuso de tx via `txctx`. Port
  `ports.TxRunner` mantem `application/` livre de imports de `pgx`.
  Adapters inbound usam interfaces locais minimas para testabilidade
  (Hex regra 3.5). `EventEnvelope.EventID` obrigatorio + propagado em
  header Kafka. Vars novas: `OUTBOX_BATCH_SIZE`, `OUTBOX_POLL_INTERVAL`.
- **Testes** (0.3.0): suite unitaria stdlib-only com `-race`; cobertura
  `application/usecase` em **97.3%**. Integration suite com
  testcontainers permanece em G4.
- **G4**: `internal/platform/metrics` (registry Prometheus isolado,
  namespace `messageserver`, 8 instrumentos cobrindo kafka consumer/outbox/
  whatsmeow/incoming/outgoing); `internal/platform/tracing` (OTLP gRPC +
  propagator W3C sempre ativo); split `/health/live` vs `/health/ready`
  (`inboundhttp`); servidor Prometheus dedicado em `:METRICS_PORT`
  (default 9090); injecao de `traceparent` no outbox; suite
  `go test -tags=integration` com testcontainers (Postgres + Redpanda)
  cobrindo create-instance, inbox idempotency, outbox retry-on-failure
  e send-text; target `make test-integration`. Vars novas:
  `METRICS_PORT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`,
  `WHATSMEOW_LOG_LEVEL`, `WHATSMEOW_DB_SCHEMA`.

Proximas iteracoes (ver [next-steps/00-INDEX.md](next-steps/00-INDEX.md)):

1. **G5** - Transcricao Whisper para audios entrantes.
2. **G6** - Production readiness (compose dev, CI/CD, hardening, migracao).
