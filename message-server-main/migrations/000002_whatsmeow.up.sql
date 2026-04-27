-- 000002_whatsmeow.up.sql
-- G3: schema dedicado para o sqlstore da lib go.mau.fi/whatsmeow.
-- A propria lib chama Container.Upgrade(ctx) para criar suas tabelas;
-- aqui apenas garantimos a existencia do schema que ela ira usar.
CREATE SCHEMA IF NOT EXISTS whatsmeow;

-- Associacao instancia <-> JID do dispositivo whatsmeow.
--
-- O JID e atribuido pelo servidor WhatsApp APOS o pareamento (PairSuccess).
-- Persistimos para que RecoverSessions consiga recuperar o Device correto
-- via container.GetDevice(jid) sem novo QR code.
ALTER TABLE message_server.instances
    ADD COLUMN IF NOT EXISTS whatsmeow_jid text;
