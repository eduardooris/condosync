import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria `payment_customers` + `resident_payment_customers`.
 *
 * Modelo: chave por `(payment_account_id, cpf)` — 1 customer Asaas
 * reutilizado por N unidades do mesmo CPF na mesma subconta.
 * Ver `docs/06_pagamentos_asaas.md §3.1`.
 */
export class PaymentCustomersTable1719200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_customers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "payment_account_id" uuid NOT NULL,
        "condominium_id" uuid NOT NULL,
        "cpf" varchar(11) NOT NULL,
        "legal_name" varchar NOT NULL,
        "email" varchar NULL,
        "phone_whatsapp" varchar NULL,
        "asaas_customer_id" varchar NOT NULL,
        "synced_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_payment_customers_account"
          FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_payment_customers_condo"
          FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payment_customers_account_cpf"
        ON "payment_customers" ("payment_account_id", "cpf")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_customers_asaas_id"
        ON "payment_customers" ("asaas_customer_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_customers_condominium"
        ON "payment_customers" ("condominium_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "resident_payment_customers" (
        "resident_id" uuid NOT NULL,
        "payment_customer_id" uuid NOT NULL,
        "linked_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("resident_id", "payment_customer_id"),
        CONSTRAINT "FK_resident_payment_customers_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_resident_payment_customers_customer"
          FOREIGN KEY ("payment_customer_id") REFERENCES "payment_customers"("id")
          ON DELETE CASCADE
      )
    `);
    // O resident pode ter histórico (várias linhas se trocou de customer),
    // mas em runtime queremos sempre a mais recente — daí índice por linked_at.
    await queryRunner.query(`
      CREATE INDEX "IDX_resident_payment_customers_resident_recent"
        ON "resident_payment_customers" ("resident_id", "linked_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "resident_payment_customers"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_customers"`);
  }
}
