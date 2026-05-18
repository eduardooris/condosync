import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Torna `condominium.cnpj` opcional + aceita CPF (11 dígitos) como
 * alternativa ao CNPJ (14). Casos cobertos:
 *
 *   - Condomínio sem CNPJ próprio (informal) → síndico recebe via CPF
 *   - Condomínio PJ → mantém CNPJ
 *
 * UNIQUE vira parcial: só impede duplicata entre valores não-nulos.
 * Múltiplos condomínios podem ficar com cnpj=NULL.
 */
export class CondominiumCnpjOptional1719500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop o constraint UNIQUE existente (criado pela coluna `unique: true`).
    // TypeORM usa um nome auto-gerado tipo `UQ_<hash>_cnpj` — varia, então
    // resolvemos via pg_constraint.
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        SELECT con.conname INTO constraint_name
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'condominiums'
          AND con.contype = 'u'
          AND con.conkey = ARRAY[
            (SELECT attnum FROM pg_attribute
             WHERE attrelid = rel.oid AND attname = 'cnpj')
          ]
        LIMIT 1;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "condominiums" DROP CONSTRAINT %I', constraint_name);
        END IF;
      END$$;
    `);

    // Tira o NOT NULL.
    await queryRunner.query(`
      ALTER TABLE "condominiums"
        ALTER COLUMN "cnpj" DROP NOT NULL
    `);

    // Re-cria como UNIQUE parcial (cobre só valores não-nulos).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_condominiums_cnpj_partial"
        ON "condominiums" ("cnpj")
        WHERE "cnpj" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_condominiums_cnpj_partial"`,
    );
    // Rollback do nullable é arriscado se houver linhas com cnpj=NULL —
    // preenchemos com '' antes pra evitar erro. Em prod, prefira não rodar
    // down sem cuidar dos dados manualmente.
    await queryRunner.query(`
      UPDATE "condominiums" SET "cnpj" = '' WHERE "cnpj" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "condominiums"
        ALTER COLUMN "cnpj" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "condominiums"
        ADD CONSTRAINT "UQ_condominiums_cnpj" UNIQUE ("cnpj")
    `);
  }
}
