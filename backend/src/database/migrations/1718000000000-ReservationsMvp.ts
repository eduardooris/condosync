import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReservationsMvp1718000000000 implements MigrationInterface {
  name = 'ReservationsMvp1718000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservations_status_enum') THEN
          CREATE TYPE "public"."reservations_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservation_areas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "condominium_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "requires_approval" boolean NOT NULL DEFAULT false,
        "max_per_unit_per_week" integer NOT NULL DEFAULT 1,
        "slot_minutes" integer NOT NULL DEFAULT 60,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservation_areas_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "condominium_id" uuid NOT NULL,
        "area_id" uuid NOT NULL,
        "unit_id" uuid NOT NULL,
        "resident_id" uuid NOT NULL,
        "start_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."reservations_status_enum" NOT NULL DEFAULT 'PENDING',
        "reviewed_by_user_id" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "cancel_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_reservation_areas_condominium'
        ) THEN
          ALTER TABLE "reservation_areas"
          ADD CONSTRAINT "FK_reservation_areas_condominium"
          FOREIGN KEY ("condominium_id")
          REFERENCES "condominiums"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_reservations_condominium'
        ) THEN
          ALTER TABLE "reservations"
          ADD CONSTRAINT "FK_reservations_condominium"
          FOREIGN KEY ("condominium_id")
          REFERENCES "condominiums"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_reservations_area'
        ) THEN
          ALTER TABLE "reservations"
          ADD CONSTRAINT "FK_reservations_area"
          FOREIGN KEY ("area_id")
          REFERENCES "reservation_areas"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_reservations_unit'
        ) THEN
          ALTER TABLE "reservations"
          ADD CONSTRAINT "FK_reservations_unit"
          FOREIGN KEY ("unit_id")
          REFERENCES "units"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_reservations_resident'
        ) THEN
          ALTER TABLE "reservations"
          ADD CONSTRAINT "FK_reservations_resident"
          FOREIGN KEY ("resident_id")
          REFERENCES "residents"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservation_areas_condo"
      ON "reservation_areas" ("condominium_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reservations_condo_area_start"
      ON "reservations" ("condominium_id", "area_id", "start_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_reservations_condo_area_start"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_reservation_areas_condo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "FK_reservations_resident"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "FK_reservations_unit"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "FK_reservations_area"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "FK_reservations_condominium"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation_areas" DROP CONSTRAINT IF EXISTS "FK_reservation_areas_condominium"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reservation_areas"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."reservations_status_enum"`,
    );
  }
}
