import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona o valor `MEMBER_PENDING_APPROVAL` ao enum
 * `notifications_type_enum`, usado para avisar ADMIN/SUB_ADMIN
 * quando um morador conclui o autocadastro via link genérico e
 * fica aguardando aprovação.
 */
export class NotificationMemberPending1718700000000 implements MigrationInterface {
  // Postgres não permite `ALTER TYPE ... ADD VALUE` dentro de uma
  // transação. Idempotente via `IF NOT EXISTS`.
  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum"
      ADD VALUE IF NOT EXISTS 'MEMBER_PENDING_APPROVAL'
    `);
  }

  public async down(): Promise<void> {
    // Postgres não suporta remover valores de enum sem recriar o tipo.
    // Como a migration apenas adiciona, o `down` é no-op.
  }
}
