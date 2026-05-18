import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asaas pode mandar `billingType: "UNDEFINED"` quando a cobrança foi
 * criada sem método fixo (cliente escolhe no Checkout). Nosso enum
 * Postgres rejeitava — agora vira varchar e aceita qualquer valor.
 *
 * Bônus: futuras adições de Asaas (ex.: PIX_DEBIT, novas modalidades)
 * não vão exigir migration.
 */
export class ChargeAsaasPaidViaVarchar1719700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Converte coluna enum → varchar(32), preservando valores existentes.
    await queryRunner.query(`
      ALTER TABLE "charges"
        ALTER COLUMN "asaas_paid_via" TYPE varchar(32)
        USING "asaas_paid_via"::text
    `);

    // Remove o tipo enum órfão. `IF EXISTS` torna a operação idempotente.
    await queryRunner.query(
      `DROP TYPE IF EXISTS charges_asaas_paid_via_enum`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recria o enum com os valores originais.
    await queryRunner.query(`
      CREATE TYPE charges_asaas_paid_via_enum AS ENUM (
        'PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'TRANSFER'
      )
    `);

    // Limpa valores fora do conjunto antes de converter — ou o ALTER falha.
    await queryRunner.query(`
      UPDATE "charges"
        SET "asaas_paid_via" = NULL
        WHERE "asaas_paid_via" NOT IN ('PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'TRANSFER')
    `);

    await queryRunner.query(`
      ALTER TABLE "charges"
        ALTER COLUMN "asaas_paid_via" TYPE charges_asaas_paid_via_enum
        USING "asaas_paid_via"::charges_asaas_paid_via_enum
    `);
  }
}
