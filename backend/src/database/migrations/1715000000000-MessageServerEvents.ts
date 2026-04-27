import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageServerEvents1715000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_server_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_id" varchar NOT NULL UNIQUE,
        "event_type" varchar NOT NULL,
        "tenant_id" varchar NULL,
        "payload" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_message_server_events_created_at"
      ON "message_server_events" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_message_server_events_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "message_server_events"`);
  }
}
