import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration "delta" da auditoria sênior — cobre apenas alterações
 * introduzidas nesta rodada (notificações in-app, isenção de unidade,
 * UNIQUE em `residents.cpf`, idempotência das tabelas dependentes).
 *
 * O **schema base** continua sendo gerado pela primeira execução do
 * app com `synchronize: true` em dev (ou pelo comando
 * `npm run typeorm:gen -- src/database/migrations/InitialSchema` em
 * um ambiente já estabilizado). A partir desta migration em diante,
 * `synchronize` está desligado em produção.
 */
export class AuditAdditions1714000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Colunas novas em `units`
    await queryRunner.query(`
      ALTER TABLE "units"
      ADD COLUMN IF NOT EXISTS "is_exempt" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "units"
      ADD COLUMN IF NOT EXISTS "exemption_reason" text NULL
    `);

    // 2. Coluna nova em `occurrences`
    await queryRunner.query(`
      ALTER TABLE "occurrences"
      ADD COLUMN IF NOT EXISTS "attachment_storage_key" varchar NULL
    `);

    // 3. Constraint UNIQUE em (unit_id, cpf) de `residents` — guia 7.3
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM   pg_constraint
          WHERE  conname = 'UQ_residents_unit_cpf'
        ) THEN
          ALTER TABLE "residents"
          ADD CONSTRAINT "UQ_residents_unit_cpf" UNIQUE ("unit_id", "cpf");
        END IF;
      END$$;
    `);

    // 4. Enum + tabela de notificações in-app
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notifications_type_enum') THEN
          CREATE TYPE "notifications_type_enum" AS ENUM (
            'CHARGE_CREATED','CHARGE_OVERDUE','CHARGE_PAID',
            'POLL_CREATED','POLL_CLOSED',
            'OCCURRENCE_STATUS','BULLETIN_NEW','DOCUMENT_NEW','BALANCE_NEGATIVE'
          );
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "condominium_id" uuid NULL,
        "type" "notifications_type_enum" NOT NULL,
        "title" varchar NOT NULL,
        "body" text NOT NULL,
        "payload" jsonb NULL,
        "read_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read"
      ON "notifications" ("user_id", "read_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_read"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_type_enum"`);
    await queryRunner.query(`
      ALTER TABLE "residents" DROP CONSTRAINT IF EXISTS "UQ_residents_unit_cpf"
    `);
    await queryRunner.query(`
      ALTER TABLE "occurrences" DROP COLUMN IF EXISTS "attachment_storage_key"
    `);
    await queryRunner.query(`
      ALTER TABLE "units" DROP COLUMN IF EXISTS "exemption_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "units" DROP COLUMN IF EXISTS "is_exempt"
    `);
  }
}
