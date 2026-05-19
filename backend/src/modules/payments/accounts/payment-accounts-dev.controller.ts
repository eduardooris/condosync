import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Charge } from '../../../database/entities/charge.entity';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/decorators/api-standard-responses.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CondominiumMemberOrMasterGuard } from '../../../common/guards/condominium-member-or-master.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums';
import { ErrorResponseDto } from '../../../common/dto/error-response.dto';
import { Env } from '../../../config/env.schema';
import {
  PaymentAccount,
  PaymentAccountApprovalStatus,
  PaymentAccountStatus,
} from '../../../database/entities/payment-account.entity';
import { PaymentEncryptionService } from '../crypto/payment-encryption.service';
import { AsaasClient } from '../asaas/asaas.client';
import { PaymentAccountsRepository } from './payment-accounts.repository';

/**
 * Endpoints de debug — disponíveis APENAS quando `ASAAS_ENV !== 'production'`.
 *
 * O guard no construtor (`assertSandbox`) trava antes do request rodar
 * mesmo se o controller for chamado em prod por engano. NÃO documentado
 * no Swagger público em prod (a tag fica oculta via filtragem).
 *
 *   • POST .../dev/force-active   — pula KYC, marca local como ACTIVE
 *   • GET  .../dev/secrets        — devolve apiKey decriptada + webhook token
 *
 * Use quando o auto-approval do painel sandbox não estiver disponível, ou
 * pra rodar `curl` manual direto contra Asaas com a apiKey da subconta.
 */
@ApiTags('payments-dev')
@ApiBearerAuth('bearer')
@ApiStandardResponses({ notFound: true })
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/payment-account/dev')
@UseGuards(CondominiumMemberOrMasterGuard, RolesGuard)
export class PaymentAccountsDevController {
  private readonly logger = new Logger(PaymentAccountsDevController.name);

  constructor(
    private readonly repo: PaymentAccountsRepository,
    private readonly crypto: PaymentEncryptionService,
    private readonly config: ConfigService<Env, true>,
    private readonly asaas: AsaasClient,
    @InjectRepository(Charge)
    private readonly chargesRepo: Repository<Charge>,
  ) {}

  /**
   * Marca a subconta local como `ACTIVE` sem consultar a Asaas — pula o
   * fluxo de KYC. Útil pra testar o resto da pipeline (geração de cobrança,
   * webhook, etc.) sem depender do painel Asaas aprovar.
   *
   * **Não muda nada no Asaas** — a subconta lá continua PENDING. Cobranças
   * vão funcionar (Asaas permite criar Payment em conta pendente), mas o
   * saque do dinheiro só rola após aprovação real.
   */
  @Post('force-active')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV] Força status ACTIVE local (pula KYC). Só sandbox.',
  })
  async forceActive(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ): Promise<{ status: PaymentAccountStatus }> {
    this.assertSandbox();
    const account = await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) {
      throw new ForbiddenException(
        'Crie a subconta primeiro (POST /payment-account).',
      );
    }
    account.status = PaymentAccountStatus.ACTIVE;
    account.commercialInfoStatus = PaymentAccountApprovalStatus.APPROVED;
    account.bankAccountInfoStatus = PaymentAccountApprovalStatus.APPROVED;
    account.documentationStatus = PaymentAccountApprovalStatus.APPROVED;
    account.rejectReason = null;
    account.lastStatusCheckAt = new Date();
    const saved = await this.repo.save(account);
    this.logger.warn(
      `DEV: payment_account ${saved.id} (condo ${condominiumId}) forçada para ACTIVE`,
    );
    return { status: saved.status };
  }

  /**
   * Retorna a apiKey decriptada da subconta + o webhook token. Útil para
   * rodar requests manuais contra a Asaas e debugar callbacks.
   *
   * **Segredos voltam em plaintext na response** — só use em sandbox.
   * Logs do servidor não imprimem o conteúdo, apenas o evento.
   */
  @Get('secrets')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[DEV] Lê apiKey + webhook token da subconta. Só sandbox.',
  })
  async getSecrets(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ): Promise<{
    asaasAccountId: string;
    asaasWalletId: string;
    asaasApiKey: string;
    asaasWebhookToken: string;
  }> {
    this.assertSandbox();
    const account = await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) {
      throw new ForbiddenException('Subconta não encontrada.');
    }
    const apiKey = this.crypto.decrypt(this.toBuffer(account.asaasApiKey));
    this.logger.warn(
      `DEV: secrets lidos de payment_account ${account.id} (condo ${condominiumId})`,
    );
    return {
      asaasAccountId: account.asaasAccountId,
      asaasWalletId: account.asaasWalletId,
      asaasApiKey: apiKey,
      asaasWebhookToken: account.asaasWebhookToken,
    };
  }

  /**
   * Lista todos os webhooks atualmente registrados na subconta (chamando
   * direto `GET /v3/webhooks` da Asaas com a apiKey da subconta).
   *
   * Use pra debugar quando o status de uma cobrança não atualiza após
   * pagamento — confira:
   *   • Existe webhook registrado?
   *   • URL aponta pro seu backend (ngrok/produção)?
   *   • `enabled=true` e `interrupted=false`?
   *   • Lista de eventos inclui PAYMENT_RECEIVED?
   */
  @Get('webhooks')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[DEV] Lista webhooks registrados na subconta Asaas. Só sandbox.',
  })
  async listWebhooks(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ) {
    this.assertSandbox();
    const apiKey = await this.resolveApiKey(condominiumId);
    const list = await this.asaas.listWebhooks(apiKey);
    return {
      expectedUrl: this.buildExpectedWebhookUrl(),
      count: list.totalCount,
      webhooks: list.data.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        enabled: w.enabled,
        interrupted: w.interrupted ?? false,
        events: w.events,
        email: w.email,
      })),
    };
  }

  /**
   * Re-registra o webhook usando a URL atual de `ASAAS_WEBHOOK_PUBLIC_BASE_URL`.
   * Útil quando o ngrok foi reiniciado (URL muda em plano free) — deleta os
   * webhooks antigos e cria um novo com o mesmo `asaas_webhook_token` local.
   */
  @Post('webhook/refresh')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV] Re-registra webhook com URL atual do .env. Só sandbox.',
  })
  async refreshWebhook(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ): Promise<{ webhookId: string; url: string; deletedOld: number }> {
    this.assertSandbox();
    const account = await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) {
      throw new ForbiddenException('Subconta não encontrada.');
    }
    const apiKey = this.crypto.decrypt(this.toBuffer(account.asaasApiKey));
    const expectedUrl = this.buildExpectedWebhookUrl();

    // 1) Lista e deleta os webhooks antigos (limpa "interrupted" antigos).
    const existing = await this.asaas.listWebhooks(apiKey);
    let deletedOld = 0;
    for (const w of existing.data) {
      try {
        await this.asaas.deleteWebhook(apiKey, w.id);
        deletedOld += 1;
      } catch (err) {
        this.logger.warn(`Falha ao deletar webhook ${w.id}: ${(err as Error).message}`);
      }
    }

    // 2) Cria um novo apontando pra URL atual.
    const created = await this.asaas.createWebhook(apiKey, {
      name: 'CondoSync',
      url: expectedUrl,
      email: account.holderEmail,
      enabled: true,
      sendType: 'SEQUENTIALLY',
      authToken: account.asaasWebhookToken,
      interrupted: false,
      poolInterrupted: false,
      apiVersion: 3,
      events: [
        'PAYMENT_CREATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED',
        'PAYMENT_REFUNDED',
        'PAYMENT_RESTORED',
      ],
    });

    this.logger.warn(
      `DEV: webhook re-registrado para condo ${condominiumId} → ${expectedUrl}`,
    );
    return { webhookId: created.id, url: expectedUrl, deletedOld };
  }

  /**
   * Simula recebimento em dinheiro de uma cobrança — chama
   * `POST /payments/{id}/receiveInCash` na Asaas com a apiKey da subconta.
   *
   * Fluxo: Asaas marca como recebido → dispara webhook
   * `PAYMENT_RECEIVED_IN_CASH` → processor local atualiza `charges.status = PAID`
   * + preenche `paid_at`, `paid_method`, `asaas_transaction_receipt_url`.
   *
   * Use pra testar a pipeline ponta-a-ponta sem precisar logar na subconta.
   */
  @Post('charges/:chargeId/receive-in-cash')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV] Marca cobrança como paga em dinheiro via Asaas. Só sandbox.',
  })
  async receiveChargeInCash(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() body: { paymentDate?: string; notifyCustomer?: boolean } = {},
  ): Promise<{ asaasPaymentId: string; status: string; webhookExpected: string }> {
    this.assertSandbox();
    const { charge, apiKey } = await this.resolveChargeAndKey(condominiumId, chargeId);
    const today = new Date().toISOString().slice(0, 10);
    const resp = await this.asaas.receivePaymentInCash(apiKey, charge.asaasPaymentId!, {
      paymentDate: body.paymentDate ?? today,
      value: Number(charge.amount),
      notifyCustomer: body.notifyCustomer ?? false,
    });
    this.logger.warn(
      `DEV: charge ${charge.id} marcada como recebida em dinheiro via Asaas`,
    );
    return {
      asaasPaymentId: resp.id,
      status: resp.status,
      webhookExpected: 'PAYMENT_RECEIVED_IN_CASH',
    };
  }

  /**
   * Simula pagamento Pix via endpoint sandbox oficial da Asaas
   * (`POST /v3/sandbox/payment/{id}/confirm`).
   *
   * É o caminho mais limpo pra simular Pix:
   *   • Asaas marca a cobrança como `RECEIVED` com `billingType: "PIX"`
   *   • Dispara webhook `PAYMENT_CONFIRMED` + `PAYMENT_RECEIVED`
   *   • `transactionReceiptUrl` é gerado normalmente — o "Ver comprovante
   *     oficial" no frontend aponta pro recibo real do Asaas
   *
   * Endpoint é sandbox-only — Asaas devolve 404 em produção.
   */
  @Post('charges/:chargeId/simulate-pix')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV] Simula pagamento Pix da cobrança. Só sandbox.',
  })
  async simulatePix(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ): Promise<{ asaasPaymentId: string; status: string; webhookExpected: string }> {
    this.assertSandbox();
    const { charge, apiKey } = await this.resolveChargeAndKey(condominiumId, chargeId);
    const resp = await this.asaas.confirmPaymentInSandbox(
      apiKey,
      charge.asaasPaymentId!,
    );
    this.logger.warn(`DEV: charge ${charge.id} confirmada como Pix via sandbox`);
    return {
      asaasPaymentId: resp.id,
      status: resp.status,
      webhookExpected: 'PAYMENT_CONFIRMED + PAYMENT_RECEIVED',
    };
  }

  /**
   * Simula pagamento via cartão de crédito de teste (sandbox).
   * Asaas aceita o cartão fictício abaixo e dispara o webhook
   * `PAYMENT_CONFIRMED` + `PAYMENT_RECEIVED` com `billingType: "CREDIT_CARD"`
   * e `transactionReceiptUrl` válido.
   *
   * Card de teste oficial Asaas sandbox (sem custo, sempre aprova):
   *   5162 3060 7196 7330  •  expiry 05/2030  •  ccv 318
   */
  @Post('charges/:chargeId/pay-with-test-card')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV] Paga cobrança com cartão de teste Asaas. Só sandbox.',
  })
  async payWithTestCard(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ): Promise<{ asaasPaymentId: string; status: string }> {
    this.assertSandbox();
    const { charge, apiKey } = await this.resolveChargeAndKey(condominiumId, chargeId);
    const resp = await this.asaas.payWithCreditCard(apiKey, charge.asaasPaymentId!, {
      creditCard: {
        holderName: 'JOAO DA SILVA',
        number: '5162306071967330',
        expiryMonth: '05',
        expiryYear: '2030',
        ccv: '318',
      },
      creditCardHolderInfo: {
        name: 'Joao da Silva',
        email: 'teste@condosync.dev',
        cpfCnpj: '24971563792',
        postalCode: '01310100',
        addressNumber: '100',
      },
      remoteIp: '127.0.0.1',
    });
    this.logger.warn(`DEV: charge ${charge.id} paga com cartão de teste`);
    return { asaasPaymentId: resp.id, status: resp.status };
  }

  /** Reverte o `receive-in-cash` acima — dispara `PAYMENT_RECEIVED_IN_CASH_UNDONE`. */
  @Post('charges/:chargeId/undo-receive-in-cash')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEV] Desfaz pagamento em dinheiro. Só sandbox.',
  })
  async undoReceiveChargeInCash(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ): Promise<{ asaasPaymentId: string; status: string }> {
    this.assertSandbox();
    const { charge, apiKey } = await this.resolveChargeAndKey(condominiumId, chargeId);
    const resp = await this.asaas.undoReceivePaymentInCash(
      apiKey,
      charge.asaasPaymentId!,
    );
    this.logger.warn(`DEV: charge ${charge.id} undo receive-in-cash`);
    return { asaasPaymentId: resp.id, status: resp.status };
  }

  /** Carrega charge + apiKey, valida que pertence ao condomínio e tem Asaas. */
  private async resolveChargeAndKey(
    condominiumId: string,
    chargeId: string,
  ): Promise<{ charge: Charge; apiKey: string }> {
    const charge = await this.chargesRepo.findOne({
      where: { id: chargeId },
      relations: ['unit'],
    });
    if (!charge) {
      throw new NotFoundException('Cobrança não encontrada.');
    }
    if (charge.unit?.condominiumId !== condominiumId) {
      throw new NotFoundException('Cobrança não pertence a este condomínio.');
    }
    if (!charge.asaasPaymentId) {
      throw new BadRequestException(
        'Cobrança não foi emitida via Asaas (sem asaas_payment_id).',
      );
    }
    const apiKey = await this.resolveApiKey(condominiumId);
    return { charge, apiKey };
  }

  private async resolveApiKey(condominiumId: string): Promise<string> {
    const account = await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) {
      throw new ForbiddenException('Subconta não encontrada.');
    }
    return this.crypto.decrypt(this.toBuffer(account.asaasApiKey));
  }

  private buildExpectedWebhookUrl(): string {
    const base =
      this.config.get('ASAAS_WEBHOOK_PUBLIC_BASE_URL', { infer: true }) ?? '';
    if (!base) {
      throw new ForbiddenException(
        'ASAAS_WEBHOOK_PUBLIC_BASE_URL não configurado no .env.',
      );
    }
    return `${base.replace(/\/$/, '')}/api/v1/integrations/asaas/webhook`;
  }

  private assertSandbox(): void {
    const asaasEnv = this.config.get('ASAAS_ENV', { infer: true });
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    const allowSandboxInProd = this.config.get('ASAAS_ALLOW_SANDBOX_IN_PROD', {
      infer: true,
    });
    if (asaasEnv === 'production') {
      throw new ForbiddenException(
        'Endpoint dev indisponível com ASAAS_ENV=production.',
      );
    }
    if (nodeEnv === 'production' && !allowSandboxInProd) {
      throw new ForbiddenException(
        'Endpoint dev indisponível em produção. Defina ASAAS_ALLOW_SANDBOX_IN_PROD=true para sandbox na VPS.',
      );
    }
  }

  /**
   * Postgres `bytea` pode vir como Buffer ou como string `\x...` dependendo
   * do driver — normaliza para Buffer aceito pelo `PaymentEncryptionService`.
   */
  private toBuffer(value: PaymentAccount['asaasApiKey']): Buffer {
    if (Buffer.isBuffer(value)) return value;
    if (typeof value === 'string') {
      const v = value as string;
      if (v.startsWith('\\x')) return Buffer.from(v.slice(2), 'hex');
      return Buffer.from(v, 'base64');
    }
    return value as unknown as Buffer;
  }
}
