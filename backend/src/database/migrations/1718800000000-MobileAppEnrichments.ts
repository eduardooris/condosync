import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enriquecimentos de schema para suportar o app mobile (CondoSync App):
 *
 *  - `bulletin_posts.pinned` — destaque de comunicados no topo
 *  - `bulletin_posts_priority_enum` — novos valores `EVENT` e `MAINTENANCE`
 *  - `visitor_entries.type` + enum `visitor_entries_type_enum`
 *  - `documents.size_bytes` + `documents.mime_type`
 *  - `notifications.deeplink`
 *
 * Postgres não aceita `ALTER TYPE ... ADD VALUE` em transação, então
 * declaramos `transaction = false` (o `data-source.ts` já está
 * configurado com `migrationsTransactionMode: 'each'`).
 */
export class MobileAppEnrichments1718800000000 implements MigrationInterface {
  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Bulletin — pinned + novos valores de enum
    await queryRunner.query(`
      ALTER TABLE "bulletin_posts"
      ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TYPE "bulletin_posts_priority_enum" ADD VALUE IF NOT EXISTS 'EVENT'
    `);
    await queryRunner.query(`
      ALTER TYPE "bulletin_posts_priority_enum" ADD VALUE IF NOT EXISTS 'MAINTENANCE'
    `);

    // 2) Visitor entries — type enum + coluna com default 'VISITA'
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visitor_entries_type_enum') THEN
          CREATE TYPE "visitor_entries_type_enum" AS ENUM ('VISITA', 'PRESTADOR', 'ENTREGA');
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      ALTER TABLE "visitor_entries"
      ADD COLUMN IF NOT EXISTS "type" "visitor_entries_type_enum" NOT NULL DEFAULT 'VISITA'
    `);

    // 3) Documents — tamanho + mime type
    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD COLUMN IF NOT EXISTS "size_bytes" bigint NULL,
      ADD COLUMN IF NOT EXISTS "mime_type" varchar(120) NULL
    `);

    // 4) Notifications — deeplink (URL relativa contextual)
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD COLUMN IF NOT EXISTS "deeplink" varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP COLUMN IF EXISTS "deeplink"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP COLUMN IF EXISTS "size_bytes",
      DROP COLUMN IF EXISTS "mime_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "visitor_entries" DROP COLUMN IF EXISTS "type"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "visitor_entries_type_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "bulletin_posts" DROP COLUMN IF EXISTS "pinned"
    `);
    // Não removemos os valores de enum 'EVENT' / 'MAINTENANCE' porque
    // Postgres não suporta DROP VALUE em enum; em prod não deve haver
    // rollback e em dev recriamos o type via outras migrations.
  }
}
