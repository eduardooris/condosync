import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona os valores `CHARGE_PAYMENT_REQUESTED` e
 * `CHARGE_PAYMENT_REJECTED` ao enum `notifications_type_enum`.
 *
 * `CHARGE_PAYMENT_REQUESTED` — morador clicou "Já paguei", síndico
 * precisa validar. `CHARGE_PAYMENT_REJECTED` — síndico rejeitou a
 * solicitação e o morador é avisado.
 */
export class NotificationChargePaymentRequest1719800001000 implements MigrationInterface {
  // Postgres não permite `ALTER TYPE ... ADD VALUE` dentro de uma transação.
  public transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum"
      ADD VALUE IF NOT EXISTS 'CHARGE_PAYMENT_REQUESTED'
    `);
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum"
      ADD VALUE IF NOT EXISTS 'CHARGE_PAYMENT_REJECTED'
    `);
  }

  public async down(): Promise<void> {
    // Postgres não suporta remover valores de enum sem recriar o tipo.
  }
}
