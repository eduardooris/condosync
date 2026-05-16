import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { IsNull, Repository } from 'typeorm';
import { endOfMonth } from 'date-fns';
import { Unit } from '../../database/entities/unit.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';
import { Resident } from '../../database/entities/resident.entity';
import { ChargeStatus, UnitStatus, UserRole } from '../../common/enums';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { Charge } from '../../database/entities/charge.entity';
import { ChargesRepository } from './charges.repository';
import { QUEUE_WHATSAPP_SEND } from '../../queues/queue-names';
import type { ChargeReminderStage } from '../../queues/messages/charge-templates';
import {
  assertChargeTransition,
  isTerminalStatus,
} from './charge-status.machine';
import { toChargeResponse } from './charge.mapper';
import { ChargeResponseDto } from './dto/charge-response.dto';

@Injectable()
export class ChargesService {
  constructor(
    private readonly chargesRepo: ChargesRepository,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
    @InjectRepository(UserCondominium)
    private readonly ucRepo: Repository<UserCondominium>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectQueue(QUEUE_WHATSAPP_SEND)
    private readonly whatsappQueue: Queue,
  ) {}

  // ── Listagens ──────────────────────────────────────────────────────

  /** Listagem completa do condomínio — só ADMIN/SUB_ADMIN devem chamar
   * (controller já enforca via RolesGuard). */
  async list(condominiumId: string): Promise<ChargeResponseDto[]> {
    const [charges, condo] = await Promise.all([
      this.chargesRepo.findByCondo(condominiumId),
      this.condoRepo.findOne({ where: { id: condominiumId } }),
    ]);
    return charges.map((c) => toChargeResponse(c, condo));
  }

  /** Cobranças do usuário autenticado em um condomínio (US-08).
   * Filtra por unidades onde o usuário aparece como morador. */
  async listMineInCondo(
    userId: string,
    condominiumId: string,
  ): Promise<ChargeResponseDto[]> {
    const unitIds = await this.resolveMineUnitIds(userId, condominiumId);
    if (unitIds.length === 0) return [];
    const [charges, condo] = await Promise.all([
      this.chargesRepo.findByUnits(unitIds),
      this.condoRepo.findOne({ where: { id: condominiumId } }),
    ]);
    return charges.map((c) => toChargeResponse(c, condo));
  }

  /** Detalhe de uma cobrança específica para morador/admin.
   * Valida que pertence ao condomínio informado. */
  async getOneInCondo(
    condominiumId: string,
    chargeId: string,
  ): Promise<ChargeResponseDto> {
    const charge = await this.findInCondo(condominiumId, chargeId);
    const condo = await this.condoRepo.findOne({
      where: { id: condominiumId },
    });
    return toChargeResponse(charge, condo);
  }

  /** Detalhe da cobrança do morador autenticado: além de pertencer ao
   * condomínio, valida que a unidade da cobrança está vinculada ao
   * usuário (evita acesso indireto a cobranças de outros moradores). */
  async getMineInCondo(
    userId: string,
    condominiumId: string,
    chargeId: string,
  ): Promise<ChargeResponseDto> {
    const charge = await this.findInCondo(condominiumId, chargeId);
    await this.assertUserOwnsChargeUnit(userId, condominiumId, charge.unitId);
    const condo = await this.condoRepo.findOne({
      where: { id: condominiumId },
    });
    return toChargeResponse(charge, condo);
  }

  // ── Criação manual ────────────────────────────────────────────────

  async create(condominiumId: string, dto: CreateChargeDto): Promise<Charge> {
    const unit = await this.unitRepo.findOne({
      where: { id: dto.unitId, condominiumId },
    });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    if (unit.isExempt) {
      throw new BadRequestException(
        'A unidade está marcada como isenta — não é possível criar cobrança.',
      );
    }
    const condo = await this.condoRepo.findOne({
      where: { id: condominiumId },
    });
    if (!condo) {
      throw new NotFoundException('Condomínio não encontrado.');
    }
    const amount = dto.amount ?? condo.monthlyFeeAmount;
    const dueDate =
      dto.dueDate ?? this.buildDueDate(dto.billingMonth, condo.billingDueDay);
    const charge = this.chargesRepo.create({
      unitId: unit.id,
      billingMonth: dto.billingMonth,
      amount: String(amount),
      dueDate,
      description: dto.description?.trim() || null,
      status: ChargeStatus.PENDING,
    });
    const saved = await this.chargesRepo.save(charge);
    await this.enqueueChargeNotification(saved.id);
    return saved;
  }

  // ── Atualização (apenas ajustes não-relacionados a status) ────────

  async update(
    condominiumId: string,
    chargeId: string,
    dto: UpdateChargeDto,
  ): Promise<Charge> {
    const charge = await this.findInCondo(condominiumId, chargeId);
    if (isTerminalStatus(charge.status)) {
      throw new BadRequestException(
        `Cobrança em status "${charge.status}" não pode ser editada. Crie um lançamento de ajuste.`,
      );
    }
    let dirty = false;
    if (dto.amount !== undefined) {
      charge.amount = String(dto.amount);
      dirty = true;
    }
    if (dto.dueDate !== undefined) {
      charge.dueDate = dto.dueDate;
      dirty = true;
    }
    if (!dirty) {
      throw new BadRequestException(
        'Nenhum campo válido fornecido para atualização.',
      );
    }
    return this.chargesRepo.save(charge);
  }

  // ── Geração mensal ────────────────────────────────────────────────

  async generateMonth(
    condominiumId: string,
    billingMonth?: string,
  ): Promise<{ created: number }> {
    const month = billingMonth ?? this.currentBillingMonth();
    const condo = await this.condoRepo.findOne({
      where: { id: condominiumId },
    });
    if (!condo) {
      throw new NotFoundException('Condomínio não encontrado.');
    }
    const units = await this.unitRepo.find({
      where: {
        condominiumId,
        status: UnitStatus.OCCUPIED,
        isExempt: false,
      },
    });
    let created = 0;
    const newIds: string[] = [];
    for (const unit of units) {
      const exists = await this.chargesRepo.findActiveByUnitAndMonth(
        unit.id,
        month,
      );
      if (exists) continue;
      const dueDate = this.buildDueDate(month, condo.billingDueDay);
      const row = await this.chargesRepo.save(
        this.chargesRepo.create({
          unitId: unit.id,
          billingMonth: month,
          amount: condo.monthlyFeeAmount,
          dueDate,
          description: null,
          status: ChargeStatus.PENDING,
        }),
      );
      newIds.push(row.id);
      created += 1;
    }
    for (const id of newIds) {
      await this.enqueueChargeNotification(id);
    }
    return { created };
  }

  // ── Ações isoladas ────────────────────────────────────────────────

  async markPaid(
    userId: string,
    chargeId: string,
    paidAt?: Date,
  ): Promise<Charge> {
    const charge = await this.chargesRepo.findByIdWithUnit(chargeId);
    if (!charge) {
      throw new NotFoundException('Cobrança não encontrada.');
    }
    await this.assertAdminOrSub(userId, charge.unit.condominiumId);
    assertChargeTransition(charge.status, ChargeStatus.PAID);
    charge.status = ChargeStatus.PAID;
    charge.paidAt = paidAt ?? new Date();
    return this.chargesRepo.save(charge);
  }

  /**
   * Auto-declaração de pagamento pelo morador (US-08 — "já paguei").
   * Valida que a cobrança pertence ao condomínio informado **e** que
   * a unidade da cobrança tem o usuário vinculado como morador.
   *
   * Hoje a transição é direta para `PAID` (mesma do markPaid admin).
   * Em V2, quando houver `IPaymentAdapter`, esta rota só deveria mover
   * para um estado `PENDING_CONFIRMATION` e o webhook do banco
   * confirmaria.
   */
  async markPaidByResident(
    userId: string,
    condominiumId: string,
    chargeId: string,
    paidAt?: Date,
  ): Promise<ChargeResponseDto> {
    const charge = await this.findInCondo(condominiumId, chargeId);
    await this.assertUserOwnsChargeUnit(userId, condominiumId, charge.unitId);
    assertChargeTransition(charge.status, ChargeStatus.PAID);
    charge.status = ChargeStatus.PAID;
    charge.paidAt = paidAt ?? new Date();
    const saved = await this.chargesRepo.save(charge);
    const condo = await this.condoRepo.findOne({
      where: { id: condominiumId },
    });
    return toChargeResponse(saved, condo);
  }

  async exempt(
    userId: string,
    chargeId: string,
    reason: string,
  ): Promise<Charge> {
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException(
        'Justificativa é obrigatória para isentar uma cobrança (RN-03.2).',
      );
    }
    const charge = await this.chargesRepo.findByIdWithUnit(chargeId);
    if (!charge) {
      throw new NotFoundException('Cobrança não encontrada.');
    }
    await this.assertAdminOrSub(userId, charge.unit.condominiumId);
    assertChargeTransition(charge.status, ChargeStatus.EXEMPT);
    charge.status = ChargeStatus.EXEMPT;
    charge.exemptReason = trimmed;
    return this.chargesRepo.save(charge);
  }

  async cancel(
    userId: string,
    chargeId: string,
    reason?: string,
  ): Promise<Charge> {
    const charge = await this.chargesRepo.findByIdWithUnit(chargeId);
    if (!charge) {
      throw new NotFoundException('Cobrança não encontrada.');
    }
    await this.assertAdminOrSub(userId, charge.unit.condominiumId);
    assertChargeTransition(charge.status, ChargeStatus.CANCELED);
    charge.status = ChargeStatus.CANCELED;
    charge.canceledAt = new Date();
    charge.cancelReason = reason?.trim() || null;
    return this.chargesRepo.save(charge);
  }

  // ── Jobs cron ─────────────────────────────────────────────────────

  /**
   * Executa diariamente. Faz a geração mensal para condomínios cujo
   * `billingGenerationDay` corresponde ao dia atual em America/Sao_Paulo
   * (e usa o último dia do mês quando o dia configurado não existe no mês).
   */
  async runScheduledGenerationForToday(): Promise<void> {
    const today = this.todayInBrazil();
    const day = today.getDate();
    const lastDay = endOfMonth(today).getDate();
    const condos = await this.condoRepo.find({
      where: { archivedAt: IsNull() },
    });
    for (const c of condos) {
      const targetDay = Math.min(c.billingGenerationDay, lastDay);
      if (targetDay === day) {
        await this.generateMonth(c.id);
      }
    }
  }

  async runOverdueAndReminders(): Promise<void> {
    const pending = await this.chargesRepo.findPendingWithUnit();
    const now = new Date();
    for (const charge of pending) {
      const due = new Date(`${charge.dueDate}T00:00:00.000Z`);
      const diffDays = Math.floor(
        (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === -3) {
        await this.enqueueCollectionReminder(charge.id, 'D_MINUS_3');
      }
      if (diffDays === 0) {
        await this.enqueueCollectionReminder(charge.id, 'D_DAY');
      }
      if (diffDays === 1) {
        await this.enqueueCollectionReminder(charge.id, 'D_PLUS_1');
      }
      if (diffDays === 5) {
        await this.enqueueCollectionReminder(charge.id, 'D_PLUS_5');
      }
      if (diffDays >= 5) {
        try {
          assertChargeTransition(charge.status, ChargeStatus.OVERDUE);
          charge.status = ChargeStatus.OVERDUE;
          await this.chargesRepo.save(charge);
          await this.enqueueOverdueReminder(charge.id);
        } catch {
          // Status já mudou desde o snapshot — ignora silenciosamente.
        }
      }
    }
  }

  // ── Helpers privados ──────────────────────────────────────────────

  private async findInCondo(
    condominiumId: string,
    chargeId: string,
  ): Promise<Charge> {
    const charge = await this.chargesRepo.findByIdWithUnit(chargeId);
    if (!charge || charge.unit.condominiumId !== condominiumId) {
      throw new NotFoundException('Cobrança não encontrada.');
    }
    return charge;
  }

  private async assertAdminOrSub(
    userId: string,
    condominiumId: string,
  ): Promise<void> {
    const row = await this.ucRepo.findOne({
      where: { userId, condominiumId },
    });
    if (!row) {
      throw new ForbiddenException('Você não pertence a este condomínio.');
    }
    if (row.role !== UserRole.ADMIN && row.role !== UserRole.SUB_ADMIN) {
      throw new ForbiddenException(
        'Apenas síndico ou subsíndico podem executar esta ação.',
      );
    }
  }

  private currentBillingMonth(): string {
    const d = this.todayInBrazil();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private buildDueDate(billingMonth: string, dueDay: number): string {
    const [yStr, mStr] = billingMonth.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const reference = new Date(Date.UTC(y, m - 1, 1));
    const lastDay = endOfMonth(reference).getUTCDate();
    const day = Math.min(Math.max(dueDay, 1), lastDay);
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Retorna a data atual no fuso `America/Sao_Paulo`. Usar `getDate`
   * direto neste valor é equivalente ao "dia local brasileiro".
   */
  private todayInBrazil(): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [{ value: y }, , { value: m }, , { value: d }] =
      formatter.formatToParts(new Date());
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  private async enqueueChargeNotification(chargeId: string): Promise<void> {
    await this.whatsappQueue.add(
      'charge-created',
      { chargeId },
      {
        // jobId determinístico — evita duplicidade em retry/reagendamento.
        jobId: `charge:${chargeId}:created`,
      },
    );
  }

  private async enqueueOverdueReminder(chargeId: string): Promise<void> {
    await this.whatsappQueue.add(
      'charge-overdue',
      { chargeId },
      { jobId: `charge:${chargeId}:overdue` },
    );
  }

  private async enqueueCollectionReminder(
    chargeId: string,
    stage: ChargeReminderStage,
  ): Promise<void> {
    await this.whatsappQueue.add(
      'charge-reminder',
      { chargeId, stage },
      { jobId: `charge:${chargeId}:reminder:${stage}` },
    );
  }

  private async enqueueChargeResend(chargeId: string): Promise<void> {
    const suffix = String(Date.now());
    await this.whatsappQueue.add(
      'charge-resend',
      { chargeId },
      { jobId: `charge:${chargeId}:resend:${suffix}` },
    );
  }

  /**
   * Reenvia um resumo (segunda via) ao responsável via WhatsApp.
   * Síndico/subsíndico; cobrança deve estar pendente ou em atraso.
   */
  async resendWhatsappNotification(
    userId: string,
    condominiumId: string,
    chargeId: string,
  ): Promise<{ enqueued: true }> {
    await this.assertAdminOrSub(userId, condominiumId);
    const charge = await this.findInCondo(condominiumId, chargeId);
    if (
      charge.status !== ChargeStatus.PENDING &&
      charge.status !== ChargeStatus.OVERDUE
    ) {
      throw new BadRequestException(
        'Só é possível reenviar o aviso de cobranças pendentes ou em atraso.',
      );
    }
    if (
      !charge.unit?.condominium?.pixKeyType ||
      !charge.unit?.condominium?.pixKeyValue
    ) {
      throw new BadRequestException(
        'Cadastre a chave Pix do condomínio antes de reenviar a cobrança.',
      );
    }
    await this.enqueueChargeResend(chargeId);
    return { enqueued: true };
  }

  /**
   * Unidades do morador no condomínio: `residents.user_id` e/ou
   * `user_condominiums.unit_id` (membership aprovado), alinhado a
   * `ResidentsService.findMyResidentOrFail`.
   */
  private async resolveMineUnitIds(
    userId: string,
    condominiumId: string,
  ): Promise<string[]> {
    const [residents, membership] = await Promise.all([
      this.residentRepo
        .createQueryBuilder('r')
        .innerJoin('r.unit', 'u')
        .where('r.user_id = :userId', { userId })
        .andWhere('u.condominium_id = :condominiumId', { condominiumId })
        .getMany(),
      this.ucRepo.findOne({
        where: {
          userId,
          condominiumId,
          status: MembershipStatus.APPROVED,
        },
      }),
    ]);

    const unitIds = new Set(residents.map((r) => r.unitId));
    if (membership?.unitId) {
      unitIds.add(membership.unitId);
    }
    return [...unitIds];
  }

  private async assertUserOwnsChargeUnit(
    userId: string,
    condominiumId: string,
    unitId: string,
  ): Promise<void> {
    const unitIds = await this.resolveMineUnitIds(userId, condominiumId);
    if (!unitIds.includes(unitId)) {
      throw new NotFoundException('Cobrança não encontrada.');
    }
  }
}
