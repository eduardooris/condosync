import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Charge } from '../../database/entities/charge.entity';
import { Unit } from '../../database/entities/unit.entity';
import { Resident } from '../../database/entities/resident.entity';
import { PaymentAccount } from '../../database/entities/payment-account.entity';
import { PaymentCustomer } from '../../database/entities/payment-customer.entity';
import { ResidentPaymentCustomer } from '../../database/entities/resident-payment-customer.entity';
import { PaymentWebhookEvent } from '../../database/entities/payment-webhook-event.entity';
import { AsaasClient } from './asaas/asaas.client';
import { PaymentEncryptionService } from './crypto/payment-encryption.service';
import { PaymentAccountsController } from './accounts/payment-accounts.controller';
import { PaymentAccountsDevController } from './accounts/payment-accounts-dev.controller';
import { PaymentAccountsRepository } from './accounts/payment-accounts.repository';
import { PaymentAccountsService } from './accounts/payment-accounts.service';
import { PaymentCustomersRepository } from './customers/payment-customers.repository';
import { PaymentCustomersService } from './customers/payment-customers.service';
import { ChargesAsaasService } from './charges/charges-asaas.service';
import { AsaasWebhookController } from './webhook/asaas-webhook.controller';
import { AsaasWebhookGuard } from './webhook/asaas-webhook.guard';
import { AsaasWebhookProcessor } from './webhook/asaas-webhook.processor';
import { ReconciliationScheduler } from './reconciliation/reconciliation.scheduler';

/**
 * Domínio de pagamentos (Asaas). `@Global()` para que ChargesService,
 * ResidentsService e outros possam injetar `PaymentAccountsService` /
 * `PaymentCustomersService` / `ChargesAsaasService` sem precisar importar
 * o módulo explicitamente.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentAccount,
      PaymentCustomer,
      ResidentPaymentCustomer,
      PaymentWebhookEvent,
      Charge,
      Unit,
      Resident,
    ]),
  ],
  controllers: [
    PaymentAccountsController,
    PaymentAccountsDevController,
    AsaasWebhookController,
  ],
  providers: [
    AsaasClient,
    PaymentEncryptionService,
    PaymentAccountsRepository,
    PaymentAccountsService,
    PaymentCustomersRepository,
    PaymentCustomersService,
    ChargesAsaasService,
    AsaasWebhookGuard,
    AsaasWebhookProcessor,
    ReconciliationScheduler,
  ],
  exports: [
    AsaasClient,
    PaymentEncryptionService,
    PaymentAccountsService,
    PaymentCustomersService,
    ChargesAsaasService,
    TypeOrmModule,
  ],
})
export class PaymentsModule {}
