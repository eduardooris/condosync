import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PaymentAccount,
  PaymentAccountStatus,
} from '../../../database/entities/payment-account.entity';

@Injectable()
export class PaymentAccountsRepository {
  constructor(
    @InjectRepository(PaymentAccount)
    private readonly repo: Repository<PaymentAccount>,
  ) {}

  /**
   * Busca a subconta do condomínio. Por padrão, NÃO traz `asaasApiKey` nem
   * `asaasWebhookToken` (marcadas `select: false` na entity) — chame
   * `findByCondominiumIdWithSecrets` quando precisar.
   */
  findByCondominiumId(condominiumId: string): Promise<PaymentAccount | null> {
    return this.repo.findOne({ where: { condominiumId } });
  }

  findByCondominiumIdWithSecrets(
    condominiumId: string,
  ): Promise<PaymentAccount | null> {
    return this.repo
      .createQueryBuilder('pa')
      .addSelect(['pa.asaasApiKey', 'pa.asaasWebhookToken'])
      .where('pa.condominium_id = :condominiumId', { condominiumId })
      .getOne();
  }

  /**
   * Resolve por token de webhook (subconta envia no header `asaas-access-token`).
   * Usado pelo `AsaasWebhookGuard` para identificar a subconta sem expor IDs.
   */
  findByWebhookToken(token: string): Promise<PaymentAccount | null> {
    return this.repo
      .createQueryBuilder('pa')
      .addSelect(['pa.asaasApiKey', 'pa.asaasWebhookToken'])
      .where('pa.asaas_webhook_token = :token', { token })
      .getOne();
  }

  findByAsaasAccountId(asaasAccountId: string): Promise<PaymentAccount | null> {
    return this.repo.findOne({ where: { asaasAccountId } });
  }

  /**
   * Conta quantas subcontas usam o mesmo `cpfCnpj` (excluindo `REJECTED`,
   * que pode retentar com mesmo CPF). Útil no pré-check de criação:
   * Asaas exige `cpfCnpj` único por subconta master.
   */
  countByCpfCnpj(
    cpfCnpj: string,
    excludeCondominiumId?: string,
  ): Promise<number> {
    const qb = this.repo
      .createQueryBuilder('pa')
      .where('pa.holder_cpf_cnpj = :cpfCnpj', { cpfCnpj })
      .andWhere('pa.status != :rejected', {
        rejected: PaymentAccountStatus.REJECTED,
      });
    if (excludeCondominiumId) {
      qb.andWhere('pa.condominium_id != :condoId', {
        condoId: excludeCondominiumId,
      });
    }
    return qb.getCount();
  }

  /** Subcontas pendentes — usadas pelo job de polling de status. */
  findPendingForPolling(): Promise<PaymentAccount[]> {
    return this.repo
      .createQueryBuilder('pa')
      .where('pa.status IN (:...statuses)', {
        statuses: [
          PaymentAccountStatus.PENDING_DOCS,
          PaymentAccountStatus.PENDING_REVIEW,
        ],
      })
      .getMany();
  }

  create(data: Partial<PaymentAccount>): PaymentAccount {
    return this.repo.create(data);
  }

  save(entity: PaymentAccount): Promise<PaymentAccount> {
    return this.repo.save(entity);
  }
}
