import { MigrationInterface, QueryRunner } from 'typeorm';

export class CondominiumPixKey1718200000000 implements MigrationInterface {
  name = 'CondominiumPixKey1718200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condominiums_pix_key_type_enum') THEN
          CREATE TYPE "public"."condominiums_pix_key_type_enum" AS ENUM('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "condominiums"
      ADD COLUMN IF NOT EXISTS "pix_key_type" "public"."condominiums_pix_key_type_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "condominiums"
      ADD COLUMN IF NOT EXISTS "pix_key_value" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "condominiums"
      DROP COLUMN IF EXISTS "pix_key_value"
    `);
    await queryRunner.query(`
      ALTER TABLE "condominiums"
      DROP COLUMN IF EXISTS "pix_key_type"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."condominiums_pix_key_type_enum"
    `);
  }
}
