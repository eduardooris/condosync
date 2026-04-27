import { MigrationInterface, QueryRunner } from 'typeorm';

export class VisitorsAndParcelsMvp1718100000000 implements MigrationInterface {
  name = 'VisitorsAndParcelsMvp1718100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visitor_entries_status_enum') THEN
          CREATE TYPE "public"."visitor_entries_status_enum" AS ENUM('EXPECTED', 'ARRIVED', 'CANCELED');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'parcels_status_enum') THEN
          CREATE TYPE "public"."parcels_status_enum" AS ENUM('RECEIVED', 'DELIVERED');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "visitor_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "condominium_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "resident_id" uuid NOT NULL,
        "visitor_name" character varying NOT NULL,
        "visitor_document" character varying,
        "expected_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."visitor_entries_status_enum" NOT NULL DEFAULT 'EXPECTED',
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_visitor_entries_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "parcels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "condominium_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "resident_id" uuid,
        "carrier" character varying NOT NULL,
        "tracking_code" character varying,
        "status" "public"."parcels_status_enum" NOT NULL DEFAULT 'RECEIVED',
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "delivered_at" TIMESTAMP WITH TIME ZONE,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_parcels_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_visitor_entries_condominium') THEN
          ALTER TABLE "visitor_entries"
          ADD CONSTRAINT "FK_visitor_entries_condominium"
          FOREIGN KEY ("condominium_id")
          REFERENCES "condominiums"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_visitor_entries_unit') THEN
          ALTER TABLE "visitor_entries"
          ADD CONSTRAINT "FK_visitor_entries_unit"
          FOREIGN KEY ("unit_id")
          REFERENCES "units"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_visitor_entries_resident') THEN
          ALTER TABLE "visitor_entries"
          ADD CONSTRAINT "FK_visitor_entries_resident"
          FOREIGN KEY ("resident_id")
          REFERENCES "residents"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_parcels_condominium') THEN
          ALTER TABLE "parcels"
          ADD CONSTRAINT "FK_parcels_condominium"
          FOREIGN KEY ("condominium_id")
          REFERENCES "condominiums"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_parcels_unit') THEN
          ALTER TABLE "parcels"
          ADD CONSTRAINT "FK_parcels_unit"
          FOREIGN KEY ("unit_id")
          REFERENCES "units"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_parcels_resident') THEN
          ALTER TABLE "parcels"
          ADD CONSTRAINT "FK_parcels_resident"
          FOREIGN KEY ("resident_id")
          REFERENCES "residents"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_visitor_entries_condo_expected"
      ON "visitor_entries" ("condominium_id", "expected_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_parcels_condo_received"
      ON "parcels" ("condominium_id", "received_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_parcels_condo_received"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_visitor_entries_condo_expected"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "FK_parcels_resident"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "FK_parcels_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parcels" DROP CONSTRAINT IF EXISTS "FK_parcels_condominium"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitor_entries" DROP CONSTRAINT IF EXISTS "FK_visitor_entries_resident"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitor_entries" DROP CONSTRAINT IF EXISTS "FK_visitor_entries_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "visitor_entries" DROP CONSTRAINT IF EXISTS "FK_visitor_entries_condominium"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "parcels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "visitor_entries"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."parcels_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."visitor_entries_status_enum"`,
    );
  }
}
