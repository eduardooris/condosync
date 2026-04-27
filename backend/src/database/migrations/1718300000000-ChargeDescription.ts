import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChargeDescription1718300000000 implements MigrationInterface {
  name = 'ChargeDescription1718300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charges"
      ADD COLUMN IF NOT EXISTS "description" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charges"
      DROP COLUMN IF EXISTS "description"
    `);
  }
}
