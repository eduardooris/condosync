-- 000002_whatsmeow.down.sql
ALTER TABLE message_server.instances
    DROP COLUMN IF EXISTS whatsmeow_jid;

DROP SCHEMA IF EXISTS whatsmeow CASCADE;
