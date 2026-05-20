import {
  BadRequestException,
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
import { ChargeStatus } from '../../common/enums';
import { TenantMembershipService } from '../../common/services/tenant-membership.service';
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
import {
  NotificationsService,
  type CreateNotificationInput,
} from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { PaymentAccountsService } from '../payments/accounts/payment-accounts.service';
import { ChargesAsaasService } from '../payments/charges/charges-asaas.service';
import { Resident } from '../../database/entities/resident.entity';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.schema';

function formatBrl(amount: number | string): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return 'R$ —';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n);
}

function formatBrazilianDate(isoDate: string): string {
  // dueDate vem no formato `YYYY-MM-DD` — formatar manualmente para evitar
  // surpresas de fuso (new Date('2026-04-10') é UTC, vira `09/04` em SP).
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

@Injectable()
export class ChargesService {
  constructor(
    private readonly chargesRepo: ChargesRepository,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
    private readonly tenantMembership: TenantMembershipService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUE_WHATSAPP_SEND)
    private readonly whatsappQueue: Queue,
    private readonly paymentAccounts: PaymentAccountsService,
    private readonly chargesAsaas: ChargesAsaasService,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Pré-flight da geração de cobranças. Bloqueia quando:
   *   - Feature flag `ASAAS_ACCOUNTS_ENABLED=false` → segue fluxo legado (Pix manual)
   *   - Subconta != ACTIVE → 403 com `code: PAYMENT_ACCOUNT_NOT_ACTIVE`
   *   - Alguma unidade não-isenta não tem responsável financeiro → 422
   *     com `code: MISSING_FINANCIAL_RESPONSIBLES` + `pendingUnitIds`
   *
   * Retorna `false` quando Asaas está desligado — caller usa pra decidir
   * se faz ou não a emissão na Asaas.
   */
  private async runChargeGenerationPreflight(
    condominiumId: string,
  ): Promise<{ asaasEnabled: boolean }> {
    const enabled = this.config.get('ASAAS_ACCOUNTS_ENABLED', { infer: true });
    if (!enabled) {
      // Modo legado — geração continua, Asaas não é chamado.
      return { asaasEnabled: false };
    }
    // RN-PG-03.1 — subconta ACTIVE.
    await this.paymentAccounts.requireActive(condominiumId);

    // RN-PG-03.2 — toda unidade não-isenta precisa de responsável financeiro.
    const pendingUnits = await this.unitRepo
      .createQueryBuilder('u')
      .leftJoin(
        Resident,
        'r',
        'r.unit_id = u.id AND r.is_financial_responsible = true',
      )
      .where('u.condominium_id = :condoId', { condoId: condominiumId })
      .andWhere('u.is_exempt = false')
      .andWhere('r.id IS NULL')
      .select(['u.id', 'u.block', 'u.number'])
      .getMany();
    if (pendingUnits.length > 0) {
      throw new BadRequestException({
        message:
          'Algumas unidades ainda não têm responsável financeiro. ' +
          'Cadastre antes de gerar cobranças.',
        code: 'MISSING_FINANCIAL_RESPONSIBLES',
        pendingUnitIds: pendingUnits.map((u) => u.id),
        pendingUnits: pendingUnits.map((u) => ({
          id: u.id,
          label: `${u.block}-${u.number}`,
        })),
      });
    }
    return { asaasEnabled: true };
  }

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
    const unitIds = await this.tenantMembership.resolveMineUnitIds(
      userId,
      condominiumId,
    );
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
    await this.tenantMembership.assertUserOwnsUnit(
      userId,
      condominiumId,
      charge.unitId,
    );
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

    // Asaas habilitado: exige subconta ACTIVE + responsável na unidade.
    // Cobrança avulsa não exige 100% das unidades, só a unidade-alvo.
    const asaasEnabled = this.config.get('ASAAS_ACCOUNTS_ENABLED', {
      infer: true,
    });
    if (asaasEnabled) {
      await this.paymentAccounts.requireActive(condominiumId);
      const hasResp = await this.residentRepo.count({
        where: { unitId: unit.id, isFinancialResponsible: true },
      });
      if (hasResp === 0) {
        throw new BadRequestException({
          message: `Unidade ${unit.block}-${unit.number} sem responsável financeiro — defina antes de criar cobrança.`,
          code: 'MISSING_FINANCIAL_RESPONSIBLE',
          unitId: unit.id,
        });
      }
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
    let saved = await this.chargesRepo.save(charge);

    // Emite na Asaas DEPOIS do save local — assim se Asaas falhar, a
    // cobrança ainda existe localmente e o admin pode acompanhar.
    if (asaasEnabled) {
      saved.unit = unit;
      saved = await this.chargesAsaas.emitPayment(saved);
    }

    await this.enqueueChargeNotification(saved.id);
    await this.notifyChargeCreated(saved, condominiumId, unit.id);
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
    // Pre-flight RN-PG-03: subconta ACTIVE + 100% das unidades têm responsável.
    // Quando ASAAS_ACCOUNTS_ENABLED=false, pula tudo (modo legado Pix manual).
    const { asaasEnabled } = await this.runChargeGenerationPreflight(
      condominiumId,
    );
    // RN: a dívida é do imóvel, não do ocupante. Geramos cobrança para
    // TODAS as unidades não isentas (incluindo VACANT) — o proprietário
    // continua responsável pela taxa mesmo quando a unidade está vazia.
    // Para isentar uma unidade permanentemente, use `isExempt = true`.
    const units = await this.unitRepo.find({
      where: {
        condominiumId,
        isExempt: false,
      },
    });
    let created = 0;
    const newIds: string[] = [];
    const notifItems: CreateNotificationInput[] = [];
    for (const unit of units) {
      const exists = await this.chargesRepo.findActiveByUnitAndMonth(
        unit.id,
        month,
      );
      if (exists) continue;
      const dueDate = this.buildDueDate(month, condo.billingDueDay);
      let row = await this.chargesRepo.save(
        this.chargesRepo.create({
          unitId: unit.id,
          billingMonth: month,
          amount: condo.monthlyFeeAmount,
          dueDate,
          description: null,
          status: ChargeStatus.PENDING,
        }),
      );
      // Emissão na Asaas — falha numa charge marca como "emitida pela metade"
      // mas não bloqueia as demais. Compensação completa (rollback de tudo)
      // seria caro e raro de bater o cenário; reconciliação cron pega.
      if (asaasEnabled) {
        try {
          row.unit = unit;
          row = await this.chargesAsaas.emitPayment(row);
        } catch (err) {
          // Não derruba o lote — apenas loga e segue. Charge fica sem
          // `asaas_payment_id`; reconciliação detectará e re-tentará.
          // (Logger formal não está injetado neste service.)
          void err;
        }
      }
      newIds.push(row.id);
      created += 1;
      // Resolve destinatários por unidade aqui mesmo — uma query por unidade,
      // mas o broadcast `createMany` final fica em transação única.
      const userIds = await this.tenantMembership.listUnitUserIds(
        condominiumId,
        unit.id,
      );
      for (const userId of userIds) {
        notifItems.push(this.buildChargeCreatedNotif(userId, row, condominiumId));
      }
    }
    for (const id of newIds) {
      await this.enqueueChargeNotification(id);
    }
    if (notifItems.length > 0) {
      try {
        await this.notifications.createMany(notifItems);
      } catch (err) {
        // Não derruba a geração — apenas loga via re-throw controlado.
        // (logger formal não está injetado neste service; manter silencioso evita
        // mascarar o sucesso da geração.)
        void err;
      }
    }
    return { created };
  }

  // ── Ações isoladas ────────────────────────────────────────────────

  async markPaid(
    userId: string,
    chargeId: string,
    paidAt?: Date,
    extra?: { method?: string; note?: string },
  ): Promise<Charge> {
    const charge = await this.chargesRepo.findByIdWithUnit(chargeId);
    if (!charge) {
      throw new NotFoundException('Cobrança não encontrada.');
    }
    await this.tenantMembership.assertAdminOrSub(
      userId,
      charge.unit.condominiumId,
    );
    assertChargeTransition(charge.status, ChargeStatus.PAID);
    charge.status = ChargeStatus.PAID;
    charge.paidAt = paidAt ?? new Date();
    if (extra?.method) {
      charge.paidMethod = extra.method;
    }
    if (extra?.note) {
      charge.paidNote = extra.note;
    }
    const saved = await this.chargesRepo.save(charge);
    // Admin baixou pagamento → avisa moradores da unidade que a quitação foi
    // registrada (confirmação visível). Falha silenciosa: pagamento não é
    // bloqueado pela disponibilidade do gateway de notif.
    await this.notifyChargePaid(saved, charge.unit.condominiumId, charge.unitId, {
      notifyAdmins: false,
    });
    return saved;
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
    await this.tenantMembership.assertUserOwnsUnit(
      userId,
      condominiumId,
      charge.unitId,
    );
    assertChargeTransition(charge.status, ChargeStatus.PAID);
    charge.status = ChargeStatus.PAID;
    charge.paidAt = paidAt ?? new Date();
    const saved = await this.chargesRepo.save(charge);
    const condo = await this.condoRepo.findOne({
      where: { id: condominiumId },
    });
    // Morador auto-declarou pagamento → notifica admins/sub-admins para
    // confirmação manual e também os co-moradores da unidade (transparência).
    await this.notifyChargePaid(saved, condominiumId, charge.unitId, {
      notifyAdmins: true,
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
    await this.tenantMembership.assertAdminOrSub(
      userId,
      charge.unit.condominiumId,
    );
    assertChargeTransition(charge.status, ChargeStatus.EXEMPT);
    // Tira da fila Asaas antes de mudar status local — não faz sentido
    // manter cobrança ativa lá pra unidade que foi isenta.
    await this.chargesAsaas.cancelPayment(charge);
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
    await this.tenantMembership.assertAdminOrSub(
      userId,
      charge.unit.condominiumId,
    );
    assertChargeTransition(charge.status, ChargeStatus.CANCELED);
    // Cancela no Asaas antes do save local. Falha silenciosa via service.
    await this.chargesAsaas.cancelPayment(charge);
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
          const saved = await this.chargesRepo.save(charge);
          await this.enqueueOverdueReminder(charge.id);
          // In-app: avisar moradores da unidade que a cobrança virou OVERDUE
          // — paralelo ao reminder WhatsApp. Falha silenciosa para não
          // travar o loop de processamento das demais cobranças.
          try {
            await this.notifyChargeOverdue(
              saved,
              saved.unit.condominiumId,
              saved.unitId,
            );
          } catch {
            /* noop */
          }
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

  // ── Notificações in-app ───────────────────────────────────────────

  /** Monta o payload de notif "cobrança criada" para um usuário. */
  private buildChargeCreatedNotif(
    userId: string,
    charge: Charge,
    condominiumId: string,
  ): CreateNotificationInput {
    return {
      userId,
      condominiumId,
      type: NotificationType.CHARGE_CREATED,
      title: 'Nova cobrança disponível',
      body: `Cobrança de ${charge.billingMonth} no valor de ${formatBrl(
        charge.amount,
      )}. Vence em ${formatBrazilianDate(charge.dueDate)}.`,
      payload: {
        chargeId: charge.id,
        billingMonth: charge.billingMonth,
        amount: charge.amount,
        dueDate: charge.dueDate,
      },
    };
  }

  /**
   * Notifica moradores da unidade que uma nova cobrança foi gerada.
   * Falha silenciosa — se ninguém estiver vinculado, nada acontece.
   */
  private async notifyChargeCreated(
    charge: Charge,
    condominiumId: string,
    unitId: string,
  ): Promise<void> {
    try {
      const userIds = await this.tenantMembership.listUnitUserIds(
        condominiumId,
        unitId,
      );
      if (userIds.length === 0) return;
      await this.notifications.createMany(
        userIds.map((userId) =>
          this.buildChargeCreatedNotif(userId, charge, condominiumId),
        ),
      );
    } catch (err) {
      void err;
    }
  }

  /**
   * Notifica que a cobrança foi confirmada como paga.
   *   - notifyAdmins=false: só moradores recebem (admin acabou de baixar manualmente).
   *   - notifyAdmins=true:  moradores + ADMIN/SUB_ADMIN (morador auto-declarou).
   */
  private async notifyChargePaid(
    charge: Charge,
    condominiumId: string,
    unitId: string,
    options: { notifyAdmins: boolean },
  ): Promise<void> {
    try {
      const recipientIds = new Set<string>(
        await this.tenantMembership.listUnitUserIds(condominiumId, unitId),
      );
      if (options.notifyAdmins) {
        const admins =
          await this.tenantMembership.listAdminUserIds(condominiumId);
        for (const a of admins) recipientIds.add(a);
      }
      if (recipientIds.size === 0) return;

      const baseBody = `Cobrança de ${charge.billingMonth} (${formatBrl(
        charge.amount,
      )}) foi confirmada como paga.`;
      await this.notifications.createMany(
        [...recipientIds].map((userId) => ({
          userId,
          condominiumId,
          type: NotificationType.CHARGE_PAID,
          title: 'Cobrança paga',
          body: baseBody,
          payload: {
            chargeId: charge.id,
            billingMonth: charge.billingMonth,
            amount: charge.amount,
            unitId,
            selfDeclared: options.notifyAdmins,
          },
        })),
      );
    } catch (err) {
      void err;
    }
  }

  /**
   * Notifica moradores que a cobrança virou OVERDUE — usado dentro do
   * cron `runOverdueAndReminders` na transição PENDING→OVERDUE.
   */
  private async notifyChargeOverdue(
    charge: Charge,
    condominiumId: string,
    unitId: string,
  ): Promise<void> {
    const userIds = await this.tenantMembership.listUnitUserIds(
      condominiumId,
      unitId,
    );
    if (userIds.length === 0) return;
    const body = `Sua cobrança de ${charge.billingMonth} (${formatBrl(
      charge.amount,
    )}) venceu em ${formatBrazilianDate(
      charge.dueDate,
    )}. Regularize para evitar bloqueios.`;
    await this.notifications.createMany(
      userIds.map((userId) => ({
        userId,
        condominiumId,
        type: NotificationType.CHARGE_OVERDUE,
        title: 'Cobrança em atraso',
        body,
        payload: {
          chargeId: charge.id,
          billingMonth: charge.billingMonth,
          amount: charge.amount,
          dueDate: charge.dueDate,
        },
      })),
    );
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
    await this.tenantMembership.assertAdminOrSub(userId, condominiumId);
    const charge = await this.findInCondo(condominiumId, chargeId);
    if (
      charge.status !== ChargeStatus.PENDING &&
      charge.status !== ChargeStatus.OVERDUE
    ) {
      throw new BadRequestException(
        'Só é possível reenviar o aviso de cobranças pendentes ou em atraso.',
      );
    }
    const hasManualPix =
      charge.unit?.condominium?.pixKeyType &&
      charge.unit?.condominium?.pixKeyValue;
    const hasAsaasPayment = Boolean(charge.asaasPaymentId);
    if (!hasManualPix && !hasAsaasPayment) {
      throw new BadRequestException(
        'Cadastre a chave Pix do condomínio ou emita a cobrança pela conta digital Asaas antes de reenviar o aviso.',
      );
    }
    await this.enqueueChargeResend(chargeId);
    return { enqueued: true };
  }
}
