import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Solicitação do morador para baixa de cobrança ("Já paguei").
 *
 * Morador clica "Avisei que paguei" → preenche `payment_request_*` (sem
 * mudar o status). Síndico recebe notificação e confirma/rejeita pela
 * interface admin. Ao confirmar (`markPaid`), as 4 colunas voltam pra
 * null — auditoria mínima fica em `paid_method`/`paid_note` + recibo.
 */
export class ChargePaymentRequest1719800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charges"
        ADD COLUMN IF NOT EXISTS "payment_request_at" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "payment_request_method" varchar(16) NULL,
        ADD COLUMN IF NOT EXISTS "payment_request_note" text NULL,
        ADD COLUMN IF NOT EXISTS "payment_request_user_id" uuid NULL
    `);

    // Índice parcial: só temos consulta "solicitações abertas" — pequeno
    // e dispensa scan da tabela inteira quando o síndico abre a fila.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_charges_payment_request_open"
        ON "charges" ("payment_request_at")
        WHERE "payment_request_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_charges_payment_request_open"`,
    );
    await queryRunner.query(`
      ALTER TABLE "charges"
        DROP COLUMN IF EXISTS "payment_request_user_id",
        DROP COLUMN IF EXISTS "payment_request_note",
        DROP COLUMN IF EXISTS "payment_request_method",
        DROP COLUMN IF EXISTS "payment_request_at"
    `);
  }
}
