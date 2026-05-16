import { MigrationInterface, QueryRunner } from 'typeorm';

export class IntercomPortariaVirtual1718900000000 implements MigrationInterface {
  name = 'IntercomPortariaVirtual1718900000000';

  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intercom_session_status_enum') THEN
          CREATE TYPE "public"."intercom_session_status_enum" AS ENUM(
            'INITIATED', 'RINGING', 'PREVIEW', 'ANSWERED', 'ENDED',
            'MISSED', 'CANCELED_BY_VISITOR', 'REJECTED', 'FAILED'
          );
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_platform_enum') THEN
          CREATE TYPE "public"."device_platform_enum" AS ENUM('IOS', 'ANDROID', 'WEB');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercom_access_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "condominium_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "label" character varying(120),
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "created_by_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercom_access_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_intercom_access_tokens_hash" UNIQUE ("token_hash")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercom_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "condominium_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "access_token_id" uuid NOT NULL,
        "visitor_name" character varying(80) NOT NULL,
        "status" "public"."intercom_session_status_enum" NOT NULL DEFAULT 'INITIATED',
        "answered_by_resident_id" uuid,
        "visitor_entry_id" uuid,
        "ring_expires_at" TIMESTAMP WITH TIME ZONE,
        "ended_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercom_sessions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intercom_session_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "event" character varying(64) NOT NULL,
        "payload_json" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intercom_session_events" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "device_registrations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "resident_id" uuid,
        "device_id" character varying(128) NOT NULL,
        "platform" "public"."device_platform_enum" NOT NULL,
        "push_token" character varying,
        "voip_token" character varying,
        "last_seen_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_registrations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_device_registrations_user_device" UNIQUE ("user_id", "device_id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_intercom_access_tokens_condominium') THEN
          ALTER TABLE "intercom_access_tokens"
          ADD CONSTRAINT "FK_intercom_access_tokens_condominium"
          FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_intercom_sessions_condominium') THEN
          ALTER TABLE "intercom_sessions"
          ADD CONSTRAINT "FK_intercom_sessions_condominium"
          FOREIGN KEY ("condominium_id") REFERENCES "condominiums"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_intercom_sessions_unit') THEN
          ALTER TABLE "intercom_sessions"
          ADD CONSTRAINT "FK_intercom_sessions_unit"
          FOREIGN KEY ("unit_id") REFERENCES "units"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_intercom_sessions_access_token') THEN
          ALTER TABLE "intercom_sessions"
          ADD CONSTRAINT "FK_intercom_sessions_access_token"
          FOREIGN KEY ("access_token_id") REFERENCES "intercom_access_tokens"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_intercom_sessions_answered_resident') THEN
          ALTER TABLE "intercom_sessions"
          ADD CONSTRAINT "FK_intercom_sessions_answered_resident"
          FOREIGN KEY ("answered_by_resident_id") REFERENCES "residents"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_intercom_sessions_visitor_entry') THEN
          ALTER TABLE "intercom_sessions"
          ADD CONSTRAINT "FK_intercom_sessions_visitor_entry"
          FOREIGN KEY ("visitor_entry_id") REFERENCES "visitor_entries"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_intercom_session_events_session') THEN
          ALTER TABLE "intercom_session_events"
          ADD CONSTRAINT "FK_intercom_session_events_session"
          FOREIGN KEY ("session_id") REFERENCES "intercom_sessions"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_device_registrations_user') THEN
          ALTER TABLE "device_registrations"
          ADD CONSTRAINT "FK_device_registrations_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_device_registrations_resident') THEN
          ALTER TABLE "device_registrations"
          ADD CONSTRAINT "FK_device_registrations_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_intercom_sessions_condominium_created"
      ON "intercom_sessions" ("condominium_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_intercom_sessions_unit_status"
      ON "intercom_sessions" ("unit_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_intercom_sessions_unit_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_intercom_sessions_condominium_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "device_registrations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercom_session_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercom_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intercom_access_tokens"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."device_platform_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."intercom_session_status_enum"`,
    );
  }
}
