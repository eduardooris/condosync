import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { Repository } from 'typeorm';
import { Charge } from '../../../database/entities/charge.entity';
import { PaymentWebhookEvent } from '../../../database/entities/payment-webhook-event.entity';
import { ChargeStatus } from '../../../common/enums';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../../database/entities/notification.entity';
import { TenantMembershipService } from '../../../common/services/tenant-membership.service';
import { QUEUE_ASAAS_WEBHOOK } from '../../../queues/queue-names';

/**
 * Processa eventos webhook do Asaas em segundo plano. Inglês simples
 * para o que cada evento faz, espelhando RN-PG-05.4–5.7:
 *
 *   PAYMENT_RECEIVED          → charges.status = PAID + notif CHARGE_PAID
 *   PAYMENT_CONFIRMED         → PAID quando `payment.status` já é RECEIVED/CONFIRMED
 *                               (Pix/cartão; alinhado ao reconciliador RN-PG-06)
 *   PAYMENT_OVERDUE           → charges.status = OVERDUE (idempotente)
 *   PAYMENT_DELETED           → charges.status = CANCELED se ainda PENDING
 *   PAYMENT_REFUNDED          → log + notif síndico (sem retornar status — manual review)
 *   PAYMENT_RESTORED          → desfaz delete (status PENDING)
 *   PAYMENT_RECEIVED_IN_CASH_UNDONE → desfaz pagamento manual (volta a PENDING)
 *
 * Cada handler é idempotente: se charge.status já está no destino, no-op.
 */
@Processor(QUEUE_ASAAS_WEBHOOK)
export class AsaasWebhookProcessor {
  private readonly logger = new Logger(AsaasWebhookProcessor.name);

  constructor(
    @InjectRepository(PaymentWebhookEvent)
    private readonly eventsRepo: Repository<PaymentWebhookEvent>,
    @InjectRepository(Charge)
    private readonly chargesRepo: Repository<Charge>,
    private readonly notifications: NotificationsService,
    private readonly tenantMembership: TenantMembershipService,
  ) {}

  @Process('process')
  async handle(job: Job<{ eventId: string }>): Promise<void> {
    const eventRow = await this.eventsRepo.findOne({
      where: { id: job.data.eventId },
    });
    if (!eventRow) {
      this.logger.warn(`Event ${job.data.eventId} not found`);
      return;
    }
    if (eventRow.processedAt) {
      // Já processado em outro retry — idempotente.
      return;
    }
    try {
      await this.dispatch(eventRow);
      eventRow.processedAt = new Date();
      eventRow.processingError = null;
    } catch (err) {
      eventRow.processingError = (err as Error).message;
      this.logger.error(
        `Webhook processing failed for ${eventRow.id}: ${(err as Error).message}`,
      );
      throw err; // Bull retenta com backoff
    } finally {
      await this.eventsRepo.save(eventRow);
    }
  }

  private async dispatch(event: PaymentWebhookEvent): Promise<void> {
    const payload = event.payloadRaw as {
      payment?: {
        id?: string;
        status?: string;
        billingType?: string;
        paymentDate?: string;
        clientPaymentDate?: string;
        transactionReceiptUrl?: string | null;
      };
    };
    const asaasPaymentId = payload.payment?.id;
    if (!asaasPaymentId) {
      this.logger.warn(`Event ${event.id} has no payment.id — skip`);
      return;
    }

    const charge = await this.chargesRepo.findOne({
      where: { asaasPaymentId },
      relations: ['unit'],
    });
    if (!charge) {
      this.logger.warn(
        `Charge not found for asaas_payment_id=${asaasPaymentId} (event ${event.event})`,
      );
      return;
    }
    charge.asaasLastEvent = event.event;
    charge.asaasSyncedAt = new Date();

    // O recibo já vem em PAYMENT_CONFIRMED em algumas situações — salva
    // sempre que estiver presente (não bloqueia se vier null).
    if (payload.payment?.transactionReceiptUrl) {
      charge.asaasTransactionReceiptUrl = payload.payment.transactionReceiptUrl;
    }

    switch (event.event) {
      case 'PAYMENT_CREATED':
      case 'PAYMENT_UPDATED':
        // Sem ação local — Asaas só está nos avisando que existe.
        break;
      case 'PAYMENT_CONFIRMED': {
        // Pix/cartão costumam vir só com CONFIRMED ou CONFIRMED antes de RECEIVED.
        // O reconciliador diário já trata `payment.status=CONFIRMED` como pago —
        // espelhamos aqui para não depender do segundo webhook.
        const remoteStatus = payload.payment?.status;
        if (
          remoteStatus &&
          ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(remoteStatus)
        ) {
          await this.markPaid(charge, payload.payment ?? null, event.event);
        }
        break;
      }
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_RECEIVED_IN_CASH':
        await this.markPaid(charge, payload.payment ?? null, event.event);
        break;
      case 'PAYMENT_OVERDUE':
        if (charge.status === ChargeStatus.PENDING) {
          charge.status = ChargeStatus.OVERDUE;
        }
        break;
      case 'PAYMENT_DELETED':
        if (charge.status === ChargeStatus.PENDING) {
          charge.status = ChargeStatus.CANCELED;
          charge.canceledAt = new Date();
          charge.cancelReason = 'Cancelada no Asaas';
        }
        break;
      case 'PAYMENT_RESTORED':
        // Asaas reverteu o delete.
        if (charge.status === ChargeStatus.CANCELED) {
          charge.status = ChargeStatus.PENDING;
          charge.canceledAt = null;
          charge.cancelReason = null;
        }
        break;
      case 'PAYMENT_REFUNDED':
        // Não tem status local "refunded" hoje — guardamos só o evento e
        // notificamos a gestão pra revisar manualmente.
        await this.notifyAdmins(
          charge,
          'Estorno recebido',
          `A cobrança de ${charge.billingMonth} (${charge.id}) foi estornada na Asaas. Revise o histórico financeiro.`,
        );
        break;
      case 'PAYMENT_RECEIVED_IN_CASH_UNDONE':
        // Reverte "baixa manual" — volta para PENDING e limpa campos de pagamento.
        if (charge.status === ChargeStatus.PAID) {
          charge.status = ChargeStatus.PENDING;
          charge.paidAt = null;
          charge.paidMethod = null;
          charge.paidNote = null;
          charge.asaasPaidVia = null;
          charge.asaasTransactionReceiptUrl = null;
          await this.notifyAdmins(
            charge,
            'Baixa de cobrança revertida',
            `A baixa manual da cobrança ${charge.billingMonth} foi desfeita no Asaas — a cobrança voltou para pendente.`,
          );
        }
        break;
      default:
        this.logger.log(`Evento ${event.event} ignorado (sem handler).`);
    }

    await this.chargesRepo.save(charge);
  }

  private async markPaid(
    charge: Charge,
    payment: {
      status?: string;
      billingType?: string;
      paymentDate?: string;
      clientPaymentDate?: string;
      transactionReceiptUrl?: string | null;
    } | null,
    eventName?: string,
  ): Promise<void> {
    if (charge.status === ChargeStatus.PAID) return;
    charge.status = ChargeStatus.PAID;
    // Prefere paymentDate (compensação real) > clientPaymentDate > now.
    const dateStr = payment?.paymentDate ?? payment?.clientPaymentDate;
    charge.paidAt = dateStr ? new Date(dateStr) : new Date();

    // Asaas pode retornar `billingType: "UNDEFINED"` quando a cobrança foi
    // criada sem método fixo (cliente escolhe no checkout). Tratamos como
    // null — não é um método real. Recebimento em dinheiro tem evento
    // próprio e seta `MANUAL_CASH` independentemente do billingType.
    if (eventName === 'PAYMENT_RECEIVED_IN_CASH') {
      charge.asaasPaidVia = 'CASH';
      charge.paidMethod = 'MANUAL_CASH';
    } else if (payment?.billingType && payment.billingType !== 'UNDEFINED') {
      charge.asaasPaidVia = payment.billingType;
      charge.paidMethod = payment.billingType;
    }

    if (payment?.transactionReceiptUrl) {
      charge.asaasTransactionReceiptUrl = payment.transactionReceiptUrl;
    }
    await this.notifyChargePaid(charge);
  }

  /**
   * Broadcast `CHARGE_PAID` para os usuários da unidade — espelha o que
   * `ChargesService.notifyChargePaid` já faz, mas reaproveitar aquele
   * helper privado exigiria refatoração; aqui temos só o que importa.
   */
  private async notifyChargePaid(charge: Charge): Promise<void> {
    try {
      const condominiumId = charge.unit?.condominiumId;
      if (!condominiumId) return;
      const userIds = await this.tenantMembership.listUnitUserIds(
        condominiumId,
        charge.unitId,
      );
      if (userIds.length === 0) return;
      await this.notifications.createMany(
        userIds.map((userId) => ({
          userId,
          condominiumId,
          type: NotificationType.CHARGE_PAID,
          title: 'Cobrança paga',
          body: `A cobrança de ${charge.billingMonth} (R$ ${charge.amount}) foi confirmada como paga.`,
          payload: {
            chargeId: charge.id,
            billingMonth: charge.billingMonth,
            amount: charge.amount,
          },
        })),
      );
    } catch (err) {
      this.logger.warn(`Notify CHARGE_PAID falhou: ${(err as Error).message}`);
    }
  }

  private async notifyAdmins(
    charge: Charge,
    title: string,
    body: string,
  ): Promise<void> {
    try {
      const condominiumId = charge.unit?.condominiumId;
      if (!condominiumId) return;
      const adminIds =
        await this.tenantMembership.listAdminUserIds(condominiumId);
      if (adminIds.length === 0) return;
      await this.notifications.createMany(
        adminIds.map((userId) => ({
          userId,
          condominiumId,
          type: NotificationType.CHARGE_PAID,
          title,
          body,
          payload: { chargeId: charge.id },
        })),
      );
    } catch (err) {
      this.logger.warn(`Notify admins falhou: ${(err as Error).message}`);
    }
  }
}
