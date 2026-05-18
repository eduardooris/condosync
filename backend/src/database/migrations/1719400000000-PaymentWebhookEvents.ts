import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria `payment_webhook_events` — auditoria + idempotência de callbacks Asaas.
 *
 * `dedup_key` UNIQUE garante que mesmo eventos duplicados (Asaas retenta em
 * 5xx) sejam processados exatamente uma vez. Ver `docs/06_pagamentos_asaas.md §3.1`.
 */
export class PaymentWebhookEvents1719400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_account_id" uuid NOT NULL,
        "event" varchar NOT NULL,
        "asaas_payment_id" varchar NULL,
        "dedup_key" varchar NOT NULL,
        "payload_raw" jsonb NOT NULL,
        "processed_at" timestamptz NULL,
        "processing_error" text NULL,
        "received_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_payment_webhook_events_account"
          FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "UQ_payment_webhook_events_dedup_key" UNIQUE ("dedup_key")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_webhook_events_payment_event"
        ON "payment_webhook_events" ("asaas_payment_id", "event")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_webhook_events_received_at"
        ON "payment_webhook_events" ("received_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_webhook_events"`);
  }
}
