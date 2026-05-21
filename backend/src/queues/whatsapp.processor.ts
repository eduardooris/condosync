import { Processor, Process } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Charge } from '../database/entities/charge.entity';
import { Poll } from '../database/entities/poll.entity';
import { Resident } from '../database/entities/resident.entity';
import { User } from '../database/entities/user.entity';
import {
  MembershipStatus,
  UserCondominium,
} from '../database/entities/user-condominium.entity';
import { UserRole } from '../common/enums';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
} from '../adapters/whatsapp/whatsapp.adapter';
import { WhatsappNotConfiguredError } from '../adapters/whatsapp/evolution-api.adapter';
import { QUEUE_WHATSAPP_SEND } from './queue-names';
import {
  ChargeReminderStage,
  renderChargeCollectionReminderMessage,
  renderChargeCreatedMessage,
  renderChargeOverdueMessage,
  renderChargePaymentRequestedMessage,
  renderChargeSecondCopyMessage,
} from './messages/charge-templates';
import { renderPollCreatedWhatsappMessage } from './messages/poll-templates';

@Processor(QUEUE_WHATSAPP_SEND)
export class WhatsappProcessor {
  private readonly logger = new Logger(WhatsappProcessor.name);

  constructor(
    @InjectRepository(Charge)
    private readonly chargeRepo: Repository<Charge>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(Poll)
    private readonly pollRepo: Repository<Poll>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
    @Inject(WHATSAPP_ADAPTER)
    private readonly whatsapp: IWhatsAppAdapter,
  ) {}

  private hasPixKey(charge: Charge): boolean {
    return Boolean(
      charge.unit?.condominium?.pixKeyType &&
      charge.unit?.condominium?.pixKeyValue,
    );
  }

  /**
   * Envolve `whatsapp.sendMessage` capturando `WhatsappNotConfiguredError`
   * e marcando o job como descartado (não falhado) para evitar retries
   * intermináveis quando o ambiente simplesmente não tem WhatsApp.
   */
  private async deliver(
    job: Job,
    phone: string,
    message: string,
  ): Promise<void> {
    if (!phone) {
      this.logger.warn(`Job ${job.id} sem telefone — descartado.`);
      return;
    }
    try {
      await this.whatsapp.sendMessage(phone, message);
    } catch (err) {
      if (err instanceof WhatsappNotConfiguredError) {
        this.logger.warn(`Job ${job.id} descartado: WhatsApp não configurado.`);
        return;
      }
      throw err;
    }
  }

  @Process('charge-created')
  async onChargeCreated(job: Job<{ chargeId: string }>): Promise<void> {
    const charge = await this.chargeRepo.findOne({
      where: { id: job.data.chargeId },
      relations: ['unit', 'unit.condominium'],
    });
    if (!charge) return;
    if (!this.hasPixKey(charge)) {
      this.logger.log(
        `Cobrança ${charge.id}: condomínio sem chave Pix configurada — sem envio.`,
      );
      return;
    }
    const resp = await this.residentRepo.findOne({
      where: { unitId: charge.unitId, isFinancialResponsible: true },
    });
    if (!resp || !resp.phoneWhatsapp) {
      this.logger.log(
        `Cobrança ${charge.id}: sem responsável financeiro com telefone — sem envio.`,
      );
      return;
    }
    const msg = renderChargeCreatedMessage(charge, resp);
    await this.deliver(job, resp.phoneWhatsapp, msg);
  }

  @Process('charge-overdue')
  async onChargeOverdue(job: Job<{ chargeId: string }>): Promise<void> {
    const charge = await this.chargeRepo.findOne({
      where: { id: job.data.chargeId },
      relations: ['unit', 'unit.condominium'],
    });
    if (!charge) return;
    if (!this.hasPixKey(charge)) return;
    const resp = await this.residentRepo.findOne({
      where: { unitId: charge.unitId, isFinancialResponsible: true },
    });
    if (!resp || !resp.phoneWhatsapp) return;
    const msg = renderChargeOverdueMessage(charge, resp);
    await this.deliver(job, resp.phoneWhatsapp, msg);
  }

  @Process('charge-resend')
  async onChargeResend(job: Job<{ chargeId: string }>): Promise<void> {
    const charge = await this.chargeRepo.findOne({
      where: { id: job.data.chargeId },
      relations: ['unit', 'unit.condominium'],
    });
    if (!charge) {
      this.logger.warn(
        `Reenvio: cobrança ${job.data.chargeId} não encontrada.`,
      );
      return;
    }
    if (!this.hasPixKey(charge)) return;
    const resp = await this.residentRepo.findOne({
      where: { unitId: charge.unitId, isFinancialResponsible: true },
    });
    if (!resp || !resp.phoneWhatsapp) {
      this.logger.log(
        `Cobrança ${charge.id}: reenvio — sem responsável com telefone.`,
      );
      return;
    }
    const msg = renderChargeSecondCopyMessage(charge, resp);
    await this.deliver(job, resp.phoneWhatsapp, msg);
  }

  @Process('charge-payment-requested')
  async onChargePaymentRequested(
    job: Job<{ chargeId: string }>,
  ): Promise<void> {
    const charge = await this.chargeRepo.findOne({
      where: { id: job.data.chargeId },
      relations: ['unit', 'unit.condominium'],
    });
    if (!charge) {
      this.logger.warn(
        `payment-requested: cobrança ${job.data.chargeId} não encontrada.`,
      );
      return;
    }
    if (!charge.paymentRequestAt) {
      this.logger.log(
        `payment-requested: cobrança ${charge.id} sem solicitação ativa (rejeitada/baixada).`,
      );
      return;
    }
    const condominiumId = charge.unit?.condominiumId;
    if (!condominiumId) return;

    // Resolve nome do morador que pediu (best-effort).
    let requesterName: string | null = null;
    if (charge.paymentRequestUserId) {
      const resident = await this.residentRepo.findOne({
        where: {
          unitId: charge.unitId,
          userId: charge.paymentRequestUserId,
        },
        select: { fullName: true },
      });
      requesterName = resident?.fullName ?? null;
    }

    // Lista síndicos/subs aprovados, com telefone cadastrado.
    const memberships = await this.membershipRepo.find({
      where: [
        {
          condominiumId,
          role: UserRole.ADMIN,
          status: MembershipStatus.APPROVED,
        },
        {
          condominiumId,
          role: UserRole.SUB_ADMIN,
          status: MembershipStatus.APPROVED,
        },
      ],
      select: { userId: true },
    });
    const adminIds = [...new Set(memberships.map((m) => m.userId))].filter(
      (x): x is string => Boolean(x),
    );
    if (adminIds.length === 0) {
      this.logger.log(
        `payment-requested: condomínio ${condominiumId} sem síndico aprovado.`,
      );
      return;
    }
    const admins = await this.userRepo.find({
      where: adminIds.map((id) => ({ id })),
      select: { id: true, fullName: true, phoneWhatsapp: true },
    });

    for (const admin of admins) {
      if (!admin.phoneWhatsapp) continue;
      const msg = renderChargePaymentRequestedMessage({
        charge,
        requesterName,
        adminName: admin.fullName,
      });
      await this.deliver(job, admin.phoneWhatsapp, msg);
    }
  }

  @Process('charge-reminder')
  async onChargeReminder(
    job: Job<{ chargeId: string; stage: ChargeReminderStage }>,
  ): Promise<void> {
    const charge = await this.chargeRepo.findOne({
      where: { id: job.data.chargeId },
      relations: ['unit', 'unit.condominium'],
    });
    if (!charge) return;
    if (!this.hasPixKey(charge)) return;
    const resp = await this.residentRepo.findOne({
      where: { unitId: charge.unitId, isFinancialResponsible: true },
    });
    if (!resp || !resp.phoneWhatsapp) return;
    const msg = renderChargeCollectionReminderMessage(
      charge,
      resp,
      job.data.stage,
    );
    await this.deliver(job, resp.phoneWhatsapp, msg);
  }

  @Process('occurrence-status')
  async onOccurrenceStatus(
    job: Job<{ phone: string; message: string }>,
  ): Promise<void> {
    await this.deliver(job, job.data.phone, job.data.message);
  }

  @Process('bulletin-urgent')
  async onBulletinUrgent(
    job: Job<{ phone: string; message: string }>,
  ): Promise<void> {
    await this.deliver(job, job.data.phone, job.data.message);
  }

  @Process('balance-negative')
  async onBalanceNegative(
    job: Job<{ phone: string; message: string }>,
  ): Promise<void> {
    await this.deliver(job, job.data.phone, job.data.message);
  }

  @Process('document-new')
  async onDocumentNew(
    job: Job<{ phone: string; message: string }>,
  ): Promise<void> {
    await this.deliver(job, job.data.phone, job.data.message);
  }

  @Process('poll-created')
  async onPollCreated(
    job: Job<{ pollId: string; phone: string }>,
  ): Promise<void> {
    const poll = await this.pollRepo.findOne({
      where: { id: job.data.pollId },
      relations: ['options', 'condominium'],
    });
    if (!poll) {
      this.logger.warn(
        `poll-created: enquete ${job.data.pollId} não encontrada — job descartado.`,
      );
      return;
    }
    const condoName = poll.condominium?.name ?? 'Condomínio';
    const msg = renderPollCreatedWhatsappMessage(
      condoName,
      poll.title,
      poll.description,
      (poll.options ?? []).map((o) => ({
        label: o.label,
        sortOrder: o.sortOrder,
      })),
      poll.closesAt,
    );
    await this.deliver(job, job.data.phone, msg);
  }
}
