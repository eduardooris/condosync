-- 000001_baseline.up.sql
-- Schema dedicado a aplicacao. O schema `whatsmeow` sera criado em G3.
CREATE SCHEMA IF NOT EXISTS message_server;

-- ============================================================================
-- instances: agregado-raiz de sessoes WhatsApp
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_server.instances (
    id          uuid        PRIMARY KEY,
    company_id  text        NOT NULL UNIQUE,
    name        text        NOT NULL,
    status      text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- messages: auditoria + idempotencia local de mensagens entrantes/saintes
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_server.messages (
    id           uuid        PRIMARY KEY,
    instance_id  uuid        NOT NULL REFERENCES message_server.instances(id) ON DELETE CASCADE,
    wpp_id       text        NOT NULL,
    direction    text        NOT NULL,
    kind         text        NOT NULL,
    peer_from    text        NOT NULL,
    peer_to      text        NOT NULL,
    body         text        NOT NULL,
    occurred_at  timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT messages_wpp_unique UNIQUE (instance_id, wpp_id, direction)
);

CREATE INDEX IF NOT EXISTS messages_instance_occurred_idx
    ON message_server.messages (instance_id, occurred_at DESC);

-- ============================================================================
-- outbox: pattern transacional consumido pelo relay (G2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_server.outbox (
    id           uuid        PRIMARY KEY,
    aggregate_id text        NOT NULL,
    topic        text        NOT NULL,
    key          bytea,
    payload      jsonb       NOT NULL,
    headers      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    attempts     int         NOT NULL DEFAULT 0,
    last_error   text
);

CREATE INDEX IF NOT EXISTS outbox_pending_idx
    ON message_server.outbox (published_at NULLS FIRST, created_at);

-- ============================================================================
-- inbox: idempotencia de eventos entrantes (G2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS message_server.inbox (
    event_id     uuid        PRIMARY KEY,
    topic        text        NOT NULL,
    processed_at timestamptz NOT NULL DEFAULT now()
);
