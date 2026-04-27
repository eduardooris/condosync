import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { entities } from './entities';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL não definido — necessário para o CLI do TypeORM.',
  );
}

/**
 * Fonte de dados usada exclusivamente pelo CLI do TypeORM
 * (`migration:generate`, `migration:run`, `migration:revert`).
 *
 * A aplicação NestJS continua usando `TypeOrmModule.forRootAsync`
 * em [app.module.ts](../app.module.ts) — esta `DataSource` NÃO é
 * importada em runtime.
 */
/**
 * IMPORTANTE: este arquivo deve ter **apenas um** export (o `DataSource`).
 * O CLI do TypeORM (>= 0.3) inspeciona o módulo e falha com
 * "Given data source file must contain only one export of DataSource instance"
 * caso encontre `export const` + `export default` apontando para a mesma
 * instância. Mantenha somente o `export default`.
 */
export default new DataSource({
  type: 'postgres',
  url,
  entities,
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  // `each` permite que migrations individuais declarem
  // `transaction = false` (ex.: `ALTER TYPE ... ADD VALUE` no Postgres,
  // que não pode rodar dentro de uma transação). As demais continuam
  // sendo executadas em transação isolada cada uma.
  migrationsTransactionMode: 'each',
  synchronize: false,
  logging: false,
});
