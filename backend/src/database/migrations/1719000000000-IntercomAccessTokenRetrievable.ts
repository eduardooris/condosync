import { MigrationInterface, QueryRunner } from 'typeorm';

export class IntercomAccessTokenRetrievable1719000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "intercom_access_tokens"
      ADD COLUMN IF NOT EXISTS "token_secret" varchar(64) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "intercom_access_tokens"
      DROP COLUMN IF EXISTS "token_secret"
    `);
  }
}
