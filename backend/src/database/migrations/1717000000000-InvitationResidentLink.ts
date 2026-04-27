import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvitationResidentLink1717000000000 implements MigrationInterface {
  name = 'InvitationResidentLink1717000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "condominium_invitations"
      ADD COLUMN IF NOT EXISTS "resident_id" uuid
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_invitation_resident'
        ) THEN
          ALTER TABLE "condominium_invitations"
          ADD CONSTRAINT "FK_invitation_resident"
          FOREIGN KEY ("resident_id")
          REFERENCES "residents"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "condominium_invitations" DROP CONSTRAINT "FK_invitation_resident"',
    );
    await queryRunner.query(
      'ALTER TABLE "condominium_invitations" DROP COLUMN "resident_id"',
    );
  }
}
