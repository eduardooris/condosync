import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Comprovante de pagamento — campos exibidos quando a cobrança vira PAID.
 *
 *   asaas_transaction_receipt_url  → link público do recibo Asaas (PIX/cartão)
 *   paid_method                    → como foi pago (uniforme com Asaas + manual)
 *   paid_note                      → observação livre do admin (manual mark)
 */
export class ChargePaymentReceipt1719600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charges"
        ADD COLUMN IF NOT EXISTS "asaas_transaction_receipt_url" varchar(512) NULL,
        ADD COLUMN IF NOT EXISTS "paid_method" varchar(32) NULL,
        ADD COLUMN IF NOT EXISTS "paid_note" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "charges"
        DROP COLUMN IF EXISTS "paid_note",
        DROP COLUMN IF EXISTS "paid_method",
        DROP COLUMN IF EXISTS "asaas_transaction_receipt_url"
    `);
  }
}
