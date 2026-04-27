import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPhoneWhatsapp1718600000000 implements MigrationInterface {
  name = 'UserPhoneWhatsapp1718600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "phone_whatsapp" character varying(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_whatsapp"`,
    );
  }
}
