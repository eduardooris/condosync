import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Env } from '../../../config/env.schema';
import { Charge } from '../../../database/entities/charge.entity';
import { ChargeStatus } from '../../../common/enums';
import { AsaasClient } from '../asaas/asaas.client';
import { PaymentAccountsService } from '../accounts/payment-accounts.service';

/**
 * Reconciliação diária: pega charges `PENDING/OVERDUE` com `asaas_payment_id`
 * mais antigas que 48h e re-sincroniza pela Asaas. Cobre webhook perdido,
 * mudança de status manual no painel do síndico, etc.
 *
 * Roda 03:00 BRT (06:00 UTC) — janela calma, não compete com a geração mensal.
 * RN-PG-06.
 */
@Injectable()
export class ReconciliationScheduler {
  private readonly logger = new Logger(ReconciliationScheduler.name);

  constructor(
    @InjectRepository(Charge)
    private readonly chargesRepo: Repository<Charge>,
    private readonly asaas: AsaasClient,
    private readonly accounts: PaymentAccountsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron('0 3 * * *', { timeZone: 'America/Sao_Paulo' })
  async runDaily(): Promise<void> {
    if (!this.config.get('ASAAS_ACCOUNTS_ENABLED', { infer: true })) {
      return;
    }
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const charges = await this.chargesRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.unit', 'u')
      .where('c.asaas_payment_id IS NOT NULL')
      .andWhere(
        new Brackets((qb) =>
          qb
            .where('c.status = :pending', { pending: ChargeStatus.PENDING })
            .orWhere('c.status = :overdue', { overdue: ChargeStatus.OVERDUE }),
        ),
      )
      .andWhere('c.asaas_synced_at < :cutoff', { cutoff })
      .limit(500) // batch máximo para uma rodada
      .getMany();

    if (charges.length === 0) {
      this.logger.log('Reconciliação: nada a reconciliar.');
      return;
    }
    this.logger.log(`Reconciliando ${charges.length} cobranças com Asaas`);

    let updated = 0;
    let failed = 0;
    for (const charge of charges) {
      try {
        const apiKey = await this.accounts.resolveApiKey(
          charge.unit.condominiumId,
        );
        const remote = await this.asaas.getPayment(
          apiKey,
          charge.asaasPaymentId!,
        );
        const changed = this.applyRemoteStatus(charge, remote.status);
        charge.asaasSyncedAt = new Date();
        if (changed) updated += 1;
        await this.chargesRepo.save(charge);
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Reconciliação falhou pra charge ${charge.id}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(
      `Reconciliação OK: ${updated} atualizadas, ${failed} falhas, ${charges.length - updated - failed} sem mudança.`,
    );
  }

  /**
   * Mapeia `payment.status` Asaas → `ChargeStatus` local. Idempotente.
   * Retorna `true` quando o status local realmente mudou.
   */
  private applyRemoteStatus(charge: Charge, remote: string): boolean {
    const next = (() => {
      switch (remote) {
        case 'RECEIVED':
        case 'RECEIVED_IN_CASH':
        case 'CONFIRMED':
          return ChargeStatus.PAID;
        case 'OVERDUE':
        case 'DUNNING_REQUESTED':
        case 'DUNNING_RECEIVED':
          return ChargeStatus.OVERDUE;
        case 'PAYMENT_DELETED':
          return ChargeStatus.CANCELED;
        case 'PENDING':
        case 'AWAITING_PAYMENT':
        case 'AWAITING_RISK_ANALYSIS':
        default:
          return ChargeStatus.PENDING;
      }
    })();
    if (charge.status === next) return false;
    charge.status = next;
    if (next === ChargeStatus.PAID && !charge.paidAt) {
      charge.paidAt = new Date();
    }
    return true;
  }
}
