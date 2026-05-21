import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, IsNull, Not } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MasterRoleGuard } from '../../common/guards/master-role.guard';
import { PaymentAccount } from '../../database/entities/payment-account.entity';
import { PaymentWebhookEvent } from '../../database/entities/payment-webhook-event.entity';
import { Charge } from '../../database/entities/charge.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { QUEUE_ASAAS_WEBHOOK } from '../../queues/queue-names';
import { PaymentAccountsService } from '../payments/accounts/payment-accounts.service';

/**
 * Endpoints cross-tenant pro back-office.
 *
 *   GET  /master/payment-accounts        → lista todas as subcontas
 *   GET  /master/payment-accounts/:id    → detalhe + condomínio + último sync
 *   GET  /master/payment-accounts/:id/secrets → apiKey + webhook token (master)
 *   GET  /master/charges                 → lista cobranças (filtros via query)
 *   GET  /master/webhook-events          → lista eventos recebidos (debug)
 *   POST /master/webhook-events/:id/reprocess → re-enfileira evento que falhou
 */
@ApiTags('master')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, MasterRoleGuard)
@Controller('master')
export class MasterPaymentsController {
  constructor(
    @InjectRepository(PaymentAccount)
    private readonly accountsRepo: Repository<PaymentAccount>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly eventsRepo: Repository<PaymentWebhookEvent>,
    @InjectRepository(Charge)
    private readonly chargesRepo: Repository<Charge>,
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
    @InjectQueue(QUEUE_ASAAS_WEBHOOK)
    private readonly webhookQueue: Queue,
    private readonly paymentAccounts: PaymentAccountsService,
  ) {}

  // ── PAYMENT ACCOUNTS ────────────────────────────────────────────────────

  @Get('payment-accounts')
  @ApiOperation({ summary: 'Lista todas as subcontas Asaas com nome do condomínio.' })
  async listPaymentAccounts() {
    const accounts = await this.accountsRepo.find({
      order: { createdAt: 'DESC' },
    });
    const condoIds = [...new Set(accounts.map((a) => a.condominiumId))];
    const condos = condoIds.length
      ? await this.condoRepo.find({ where: { id: In(condoIds) } })
      : [];
    const condoById = new Map(condos.map((c) => [c.id, c]));
    return accounts.map((a) => ({
      id: a.id,
      condominiumId: a.condominiumId,
      condominiumName: condoById.get(a.condominiumId)?.name ?? null,
      holderType: a.holderType,
      holderLegalName: a.holderLegalName,
      holderEmail: a.holderEmail,
      status: a.status,
      commercialInfoStatus: a.commercialInfoStatus,
      bankAccountInfoStatus: a.bankAccountInfoStatus,
      documentationStatus: a.documentationStatus,
      rejectReason: a.rejectReason,
      asaasAccountId: a.asaasAccountId,
      lastStatusCheckAt: a.lastStatusCheckAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  }

  @Get('payment-accounts/:id')
  @ApiOperation({ summary: 'Detalhe de uma subconta + métricas.' })
  async getPaymentAccount(@Param('id', ParseUUIDPipe) id: string) {
    const account = await this.accountsRepo.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException('Subconta não encontrada.');
    }
    const condo = await this.condoRepo.findOne({
      where: { id: account.condominiumId },
    });
    const [totalCharges, paidCharges, pendingCharges] = await Promise.all([
      this.chargesRepo
        .createQueryBuilder('c')
        .leftJoin('c.unit', 'u')
        .where('u.condominium_id = :cid', { cid: account.condominiumId })
        .getCount(),
      this.chargesRepo
        .createQueryBuilder('c')
        .leftJoin('c.unit', 'u')
        .where('u.condominium_id = :cid', { cid: account.condominiumId })
        .andWhere('c.status = :s', { s: 'PAID' })
        .getCount(),
      this.chargesRepo
        .createQueryBuilder('c')
        .leftJoin('c.unit', 'u')
        .where('u.condominium_id = :cid', { cid: account.condominiumId })
        .andWhere('c.status IN (:...s)', { s: ['PENDING', 'OVERDUE'] })
        .getCount(),
    ]);
    return {
      id: account.id,
      condominiumId: account.condominiumId,
      condominiumName: condo?.name ?? null,
      holderType: account.holderType,
      holderLegalName: account.holderLegalName,
      holderEmail: account.holderEmail,
      holderMobilePhone: account.holderMobilePhone,
      holderCpfCnpj: account.holderCpfCnpj,
      status: account.status,
      commercialInfoStatus: account.commercialInfoStatus,
      bankAccountInfoStatus: account.bankAccountInfoStatus,
      documentationStatus: account.documentationStatus,
      rejectReason: account.rejectReason,
      asaasAccountId: account.asaasAccountId,
      asaasWalletId: account.asaasWalletId,
      onboardingUrl: account.onboardingUrl,
      lastStatusCheckAt: account.lastStatusCheckAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      metrics: { totalCharges, paidCharges, pendingCharges },
    };
  }

  @Get('payment-accounts/:id/secrets')
  @ApiOperation({
    summary:
      'Credenciais da subconta (apiKey + webhook token). Somente master-admin.',
  })
  getPaymentAccountSecrets(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentAccounts.getSecretsByAccountId(id);
  }

  // ── CHARGES ────────────────────────────────────────────────────────────

  @Get('charges')
  @ApiOperation({
    summary: 'Lista cobranças (cross-tenant). Filtros via query: status, condominiumId, asaasPaymentId, search.',
  })
  async listCharges(
    @Query('status') status?: string,
    @Query('condominiumId') condominiumId?: string,
    @Query('asaasPaymentId') asaasPaymentId?: string,
    @Query('search') search?: string,
    @Query('limit') limit = '50',
  ) {
    const qb = this.chargesRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.unit', 'u')
      .orderBy('c.createdAt', 'DESC')
      .take(Math.min(Number(limit) || 50, 200));

    if (status) qb.andWhere('c.status = :status', { status });
    if (condominiumId) qb.andWhere('u.condominium_id = :cid', { cid: condominiumId });
    if (asaasPaymentId) qb.andWhere('c.asaas_payment_id = :pid', { pid: asaasPaymentId });
    if (search) {
      qb.andWhere(
        '(c.description ILIKE :q OR c.asaas_payment_id ILIKE :q OR c.id::text ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    const list = await qb.getMany();
    const condoIds = [...new Set(list.map((c) => c.unit?.condominiumId).filter(Boolean) as string[])];
    const condos = condoIds.length
      ? await this.condoRepo.find({ where: { id: In(condoIds) } })
      : [];
    const condoById = new Map(condos.map((c) => [c.id, c.name]));

    return list.map((c) => ({
      id: c.id,
      condominiumId: c.unit?.condominiumId ?? null,
      condominiumName: condoById.get(c.unit?.condominiumId ?? '') ?? null,
      unitId: c.unitId,
      unitLabel: c.unit ? `${c.unit.block} • ${c.unit.number}` : null,
      billingMonth: c.billingMonth,
      amount: c.amount,
      dueDate: c.dueDate,
      status: c.status,
      paidAt: c.paidAt,
      paidMethod: c.paidMethod,
      asaasPaymentId: c.asaasPaymentId,
      asaasLastEvent: c.asaasLastEvent,
      asaasSyncedAt: c.asaasSyncedAt,
      createdAt: c.createdAt,
    }));
  }

  // ── WEBHOOK EVENTS ─────────────────────────────────────────────────────

  @Get('webhook-events')
  @ApiOperation({
    summary: 'Lista eventos webhook recebidos. Filtros: event, status (processed/failed/pending), paymentAccountId.',
  })
  async listWebhookEvents(
    @Query('event') event?: string,
    @Query('status') status?: 'processed' | 'failed' | 'pending',
    @Query('paymentAccountId') paymentAccountId?: string,
    @Query('asaasPaymentId') asaasPaymentId?: string,
    @Query('limit') limit = '50',
  ) {
    const where: Record<string, unknown> = {};
    if (event) where.event = Like(`%${event}%`);
    if (paymentAccountId) where.paymentAccountId = paymentAccountId;
    if (asaasPaymentId) where.asaasPaymentId = asaasPaymentId;
    if (status === 'processed') where.processedAt = Not(IsNull());
    if (status === 'pending') {
      where.processedAt = IsNull();
      where.processingError = IsNull();
    }
    if (status === 'failed') {
      where.processedAt = IsNull();
      where.processingError = Not(IsNull());
    }

    const list = await this.eventsRepo.find({
      where: where as Parameters<typeof this.eventsRepo.find>[0] extends { where?: infer W }
        ? W
        : never,
      order: { receivedAt: 'DESC' },
      take: Math.min(Number(limit) || 50, 200),
    });
    return list.map((e) => ({
      id: e.id,
      event: e.event,
      asaasPaymentId: e.asaasPaymentId,
      paymentAccountId: e.paymentAccountId,
      receivedAt: e.receivedAt,
      processedAt: e.processedAt,
      processingError: e.processingError,
      payloadPreview: extractPaymentPreview(e.payloadRaw),
    }));
  }

  @Get('webhook-events/:id')
  @ApiOperation({ summary: 'Detalhe completo do evento (payload raw).' })
  async getWebhookEvent(@Param('id', ParseUUIDPipe) id: string) {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) return null;
    return event;
  }

  @Post('payment-accounts/refresh-webhooks')
  @ApiOperation({
    summary: 'Atualiza os webhooks Asaas de todas as subcontas ativas',
    description:
      'Para cada subconta ACTIVE, verifica se o webhook registrado na Asaas inclui ' +
      'todos os eventos exigidos pelo CondoSync. Se faltar algum (ex.: ' +
      '`PAYMENT_RECEIVED_IN_CASH`), re-registra. Idempotente e seguro de rodar várias vezes.',
  })
  async refreshAllWebhooks() {
    return this.paymentAccounts.refreshAllWebhooks();
  }

  @Post('payment-accounts/:id/refresh-webhook')
  @ApiOperation({
    summary: 'Atualiza o webhook Asaas de uma subconta específica',
  })
  async refreshWebhookForAccount(@Param('id', ParseUUIDPipe) id: string) {
    const account = await this.accountsRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Subconta não encontrada.');
    const changed = await this.paymentAccounts.refreshWebhookForCondominium(
      account.condominiumId,
    );
    return { ok: true, refreshed: changed };
  }

  @Post('webhook-events/:id/reprocess')
  @ApiOperation({
    summary: 'Re-enfileira evento falho/pendente para nova tentativa de processamento.',
  })
  async reprocessWebhookEvent(@Param('id', ParseUUIDPipe) id: string) {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) return { ok: false, reason: 'not_found' };
    // Limpa erro anterior pra processor não pular.
    event.processedAt = null;
    event.processingError = null;
    await this.eventsRepo.save(event);
    await this.webhookQueue.add(
      'process',
      { eventId: event.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000 } },
    );
    return { ok: true, queued: event.id };
  }
}

/**
 * Resumo legível do payload Asaas pra exibir na lista — pegamos só os campos
 * mais relevantes pra debug em UI. Payload inteiro fica disponível no detalhe.
 */
function extractPaymentPreview(
  payload: Record<string, unknown> | null | undefined,
): { id?: string; status?: string; value?: number; billingType?: string } {
  const payment = (payload?.payment as Record<string, unknown> | undefined) ?? {};
  return {
    id: typeof payment.id === 'string' ? payment.id : undefined,
    status: typeof payment.status === 'string' ? payment.status : undefined,
    value: typeof payment.value === 'number' ? payment.value : undefined,
    billingType: typeof payment.billingType === 'string' ? payment.billingType : undefined,
  };
}
