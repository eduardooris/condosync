import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Adiciona o valor `CANCELED` ao enum `charges_status_enum`.
 * - Cria as colunas `canceled_at` e `cancel_reason` em `charges`.
 * - Remove a constraint UNIQUE `(unit_id, billing_month)` para
 *   permitir múltiplas cobranças no mesmo mês para a mesma unidade
 *   (ex.: mensalidade + taxa extra). A geração mensal automática
 *   (`generateMonth`) continua idempotente porque agora valida
 *   apenas cobranças *ativas* (PENDING/OVERDUE) — o admin pode
 *   cancelar uma cobrança gerada errada e a próxima execução
 *   cria normalmente.
 */
export class ChargeCancellationAndDuplicates1716000000000 implements MigrationInterface {
  // Postgres não permite `ALTER TYPE ... ADD VALUE` dentro de uma
  // transação. Desabilitar o wrapper transacional do TypeORM
  // (a migration vira "best effort" mas é idempotente via IF NOT EXISTS).
  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "charges_status_enum" ADD VALUE IF NOT EXISTS 'CANCELED'
    `);
    await queryRunner.query(`
      ALTER TABLE "charges"
      ADD COLUMN IF NOT EXISTS "canceled_at" timestamptz NULL,
      ADD COLUMN IF NOT EXISTS "cancel_reason" text NULL
    `);
    // Drop unique constraint by name (TypeORM gera UQ_<hash>) — caímos
    // em fallback para qualquer índice único equivalente.
    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
      BEGIN
        FOR r IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = '"charges"'::regclass
            AND contype = 'u'
        LOOP
          EXECUTE format('ALTER TABLE "charges" DROP CONSTRAINT %I', r.conname);
        END LOOP;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charges" DROP COLUMN IF EXISTS "cancel_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "charges" DROP COLUMN IF EXISTS "canceled_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "charges"
      ADD CONSTRAINT "UQ_charges_unit_billing_month"
      UNIQUE ("unit_id", "billing_month")
    `);
  }
}
