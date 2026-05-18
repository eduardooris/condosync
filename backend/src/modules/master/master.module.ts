import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAccount } from '../../database/entities/payment-account.entity';
import { PaymentWebhookEvent } from '../../database/entities/payment-webhook-event.entity';
import { Charge } from '../../database/entities/charge.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { MasterPaymentsController } from './master-payments.controller';

/**
 * Módulo do **back-office (`admin/`)** — endpoints cross-tenant para operação
 * e debug do produto. Todos protegidos por `MasterRoleGuard` (realm role
 * `master-admin` no Keycloak).
 *
 * NÃO importar este módulo a partir de outros módulos de domínio. Ele
 * depende de várias entities e tem permissões altas; manter isolado evita
 * vazamentos de privilégio.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentAccount,
      PaymentWebhookEvent,
      Charge,
      Condominium,
    ]),
  ],
  controllers: [MasterPaymentsController],
})
export class MasterModule {}
