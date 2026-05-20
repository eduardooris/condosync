import { Injectable, NotFoundException } from '@nestjs/common';
import { toAsaasMobilePhone } from '../../../common/utils/br-documents';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Resident } from '../../../database/entities/resident.entity';
import { PaymentCustomer } from '../../../database/entities/payment-customer.entity';
import { AsaasClient } from '../asaas/asaas.client';
import { PaymentAccountsService } from '../accounts/payment-accounts.service';
import { PaymentCustomersRepository } from './payment-customers.repository';

/**
 * Orquestra `Customer` Asaas por subconta.
 *
 * Idempotência por design — `ensureForResponsible(condominiumId, resident)`:
 *
 *   1. Resolve subconta ativa do condomínio (`PaymentAccountsService.requireActive`)
 *   2. Procura customer por `(payment_account_id, cpf)` — se existe, reusa
 *   3. Se não existe, cria via `POST /customers` (apiKey da subconta)
 *   4. Linka `resident.id → customer.id` em `resident_payment_customers`
 *
 * É seguro chamar várias vezes — só re-emite POST quando realmente é um
 * CPF novo na subconta.
 */
@Injectable()
export class PaymentCustomersService {
  constructor(
    private readonly repo: PaymentCustomersRepository,
    private readonly accounts: PaymentAccountsService,
    private readonly asaas: AsaasClient,
    @InjectPinoLogger(PaymentCustomersService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Garante que existe um `PaymentCustomer` para o CPF do residente na
   * subconta do condomínio + linka o `Resident` a ele. Retorna o customer.
   */
  async ensureForResponsible(
    condominiumId: string,
    resident: Pick<Resident, 'id' | 'cpf' | 'fullName' | 'email' | 'phoneWhatsapp'>,
  ): Promise<PaymentCustomer> {
    const account = await this.accounts.requireActive(condominiumId);
    const apiKey = await this.accounts.resolveApiKey(condominiumId);
    const mobilePhone = toAsaasMobilePhone(resident.phoneWhatsapp);

    // 1) Reuso por (payment_account_id, cpf).
    let customer = await this.repo.findByAccountAndCpf(account.id, resident.cpf);

    if (customer) {
      // Mantém Asaas sincronizado se mudou nome/email/telefone — best-effort.
      const dirty =
        customer.legalName !== resident.fullName ||
        customer.email !== (resident.email ?? null) ||
        customer.phoneWhatsapp !== (resident.phoneWhatsapp ?? null);
      if (dirty) {
        try {
          await this.asaas.createCustomer(apiKey, {
            // Asaas faz upsert por externalReference + cpfCnpj — recriar
            // (POST) com mesmo cpf devolve o mesmo customer.id.
            name: resident.fullName,
            cpfCnpj: resident.cpf,
            email: resident.email ?? undefined,
            mobilePhone,
            externalReference: customer.id,
          });
          customer.legalName = resident.fullName;
          customer.email = resident.email ?? null;
          customer.phoneWhatsapp = resident.phoneWhatsapp ?? null;
          customer.syncedAt = new Date();
          customer = await this.repo.saveCustomer(customer);
        } catch (err) {
          // Não bloqueia — o customer base já existe; sincronização pode
          // ser retentada depois sem ônus.
          this.logger.warn(
            { customerId: customer.id, err_message: (err as Error).message },
            'asaas.customer.sync_failed',
          );
        }
      }
    } else {
      // 2) Cria no Asaas + persiste local.
      const created = await this.asaas.createCustomer(apiKey, {
        name: resident.fullName,
        cpfCnpj: resident.cpf,
        email: resident.email ?? undefined,
        mobilePhone,
        externalReference: `condo:${condominiumId}:resident:${resident.id}`,
      });
      customer = await this.repo.saveCustomer(
        this.repo.createCustomer({
          paymentAccountId: account.id,
          condominiumId,
          cpf: resident.cpf,
          legalName: resident.fullName,
          email: resident.email ?? null,
          phoneWhatsapp: resident.phoneWhatsapp ?? null,
          asaasCustomerId: created.id,
          syncedAt: new Date(),
        }),
      );
      this.logger.info(
        {
          condominiumId,
          residentId: resident.id,
          asaasCustomerId: created.id,
        },
        'asaas.customer.created',
      );
    }

    // 3) Linka resident → customer (idempotente).
    await this.repo.linkResident(resident.id, customer.id);
    return customer;
  }

  /**
   * Retorna o customer atual de um residente — usado pelo ChargesService
   * para resolver `customer` ao criar um Payment. Lança 404 se não tem.
   */
  async getCurrentByResident(residentId: string): Promise<PaymentCustomer> {
    const c = await this.repo.findCurrentByResident(residentId);
    if (!c) {
      throw new NotFoundException(
        'Residente ainda não tem cliente cadastrado no gateway de pagamento.',
      );
    }
    return c;
  }
}
