-- 000001_baseline.down.sql
DROP TABLE IF EXISTS message_server.inbox;
DROP TABLE IF EXISTS message_server.outbox;
DROP TABLE IF EXISTS message_server.messages;
DROP TABLE IF EXISTS message_server.instances;
DROP SCHEMA IF EXISTS message_server;
