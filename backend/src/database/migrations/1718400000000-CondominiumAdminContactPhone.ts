import { MigrationInterface, QueryRunner } from 'typeorm';

export class CondominiumAdminContactPhone1718400000000 implements MigrationInterface {
  name = 'CondominiumAdminContactPhone1718400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "condominiums"
      ADD COLUMN IF NOT EXISTS "admin_contact_phone" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "condominiums"
      DROP COLUMN IF EXISTS "admin_contact_phone"
    `);
  }
}
