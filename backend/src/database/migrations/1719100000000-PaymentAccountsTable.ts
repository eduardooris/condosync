import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria a tabela `payment_accounts` — subconta Asaas por condomínio.
 *
 * Ver `docs/06_pagamentos_asaas.md §3.1` para shape detalhado e
 * `payment-account.entity.ts` para a definição autoritativa em código.
 *
 * Próximas migrations seguirão (não nesta):
 *   - `payment_customers` (responsáveis financeiros como Customer Asaas)
 *   - extensão da `charges` com colunas `asaas_*`
 *   - `payment_webhook_events` (idempotência + auditoria)
 */
export class PaymentAccountsTable1719100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."payment_account_holder_type_enum"
        AS ENUM ('PF', 'MEI', 'PJ')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."payment_account_status_enum"
        AS ENUM (
          'DRAFT',
          'PENDING_DOCS',
          'PENDING_REVIEW',
          'ACTIVE',
          'BLOCKED',
          'REJECTED'
        )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."payment_account_approval_status_enum"
        AS ENUM ('PENDING', 'AWAITING_DOCS', 'APPROVED', 'REJECTED')
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "condominium_id" uuid NOT NULL,
        "holder_type" "public"."payment_account_holder_type_enum" NOT NULL,
        "holder_cpf_cnpj" varchar(14) NOT NULL,
        "holder_legal_name" varchar NOT NULL,
        "holder_birth_date" date NULL,
        "holder_email" varchar NOT NULL,
        "holder_mobile_phone" varchar(15) NOT NULL,
        "holder_income_value" numeric(12, 2) NOT NULL,
        "holder_address" jsonb NOT NULL,
        "asaas_account_id" varchar NOT NULL,
        "asaas_wallet_id" varchar NOT NULL,
        "asaas_api_key" bytea NOT NULL,
        "asaas_webhook_token" varchar NOT NULL,
        "status" "public"."payment_account_status_enum" NOT NULL DEFAULT 'DRAFT',
        "commercial_info_status" "public"."payment_account_approval_status_enum" NULL,
        "bank_account_info_status" "public"."payment_account_approval_status_enum" NULL,
        "documentation_status" "public"."payment_account_approval_status_enum" NULL,
        "reject_reason" text NULL,
        "onboarding_url" varchar(512) NULL,
        "last_status_check_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_payment_accounts_condominium"
          FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id")
          ON DELETE CASCADE
      )
    `);

    // 1:1 com condomínio — protege contra criar 2 subcontas pro mesmo condo.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_payment_accounts_condominium_id"
        ON "payment_accounts" ("condominium_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_accounts_asaas_account_id"
        ON "payment_accounts" ("asaas_account_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_accounts_status"
        ON "payment_accounts" ("status")
    `);
    // O webhook resolve a subconta pelo token recebido no header — precisa de
    // lookup O(1) e o token tem que ser único globalmente.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_payment_accounts_webhook_token"
        ON "payment_accounts" ("asaas_webhook_token")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_accounts"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."payment_account_approval_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."payment_account_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."payment_account_holder_type_enum"`,
    );
  }
}
