import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extende `charges` com os campos da integração Asaas.
 *
 * Cobranças antigas (criadas antes do go-live) ficam com tudo `null` e
 * continuam funcionando como Pix manual — sem migração de dados.
 */
export class ChargeAsaasFields1719300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."charges_asaas_paid_via_enum"
        AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'TRANSFER')
    `);
    await queryRunner.query(`
      ALTER TABLE "charges"
        ADD COLUMN IF NOT EXISTS "asaas_payment_id" varchar NULL,
        ADD COLUMN IF NOT EXISTS "asaas_invoice_url" varchar(512) NULL,
        ADD COLUMN IF NOT EXISTS "asaas_pix_payload" text NULL,
        ADD COLUMN IF NOT EXISTS "asaas_pix_qr_base64" text NULL,
        ADD COLUMN IF NOT EXISTS "asaas_bank_slip_url" varchar(512) NULL,
        ADD COLUMN IF NOT EXISTS "asaas_paid_via" "public"."charges_asaas_paid_via_enum" NULL,
        ADD COLUMN IF NOT EXISTS "asaas_last_event" varchar NULL,
        ADD COLUMN IF NOT EXISTS "asaas_synced_at" timestamptz NULL
    `);
    // Unique parcial — só conta cobranças com asaas_payment_id preenchido.
    // Garante idempotência sem bloquear cobranças locais sem Asaas.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_charges_asaas_payment_id"
        ON "charges" ("asaas_payment_id")
        WHERE "asaas_payment_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_charges_asaas_payment_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "charges"
        DROP COLUMN IF EXISTS "asaas_synced_at",
        DROP COLUMN IF EXISTS "asaas_last_event",
        DROP COLUMN IF EXISTS "asaas_paid_via",
        DROP COLUMN IF EXISTS "asaas_bank_slip_url",
        DROP COLUMN IF EXISTS "asaas_pix_qr_base64",
        DROP COLUMN IF EXISTS "asaas_pix_payload",
        DROP COLUMN IF EXISTS "asaas_invoice_url",
        DROP COLUMN IF EXISTS "asaas_payment_id"
    `);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."charges_asaas_paid_via_enum"`,
    );
  }
}
