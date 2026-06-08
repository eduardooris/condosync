import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { randomBytes } from 'node:crypto';
import { Env } from '../../../config/env.schema';
import {
  PaymentAccount,
  PaymentAccountApprovalStatus,
  PaymentAccountHolderType,
  PaymentAccountStatus,
} from '../../../database/entities/payment-account.entity';
import { AsaasClient } from '../asaas/asaas.client';
import {
  AsaasAccountApprovalStatus,
  AsaasAccountStatusResponse,
  AsaasWebhookEvent,
} from '../asaas/asaas.types';
import { PaymentEncryptionService } from '../crypto/payment-encryption.service';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import {
  CreatePaymentAccountResponseDto,
  PaymentAccountResponseDto,
} from './dto/payment-account-response.dto';
import { PaymentAccountsRepository } from './payment-accounts.repository';

/**
 * Orquestra a subconta Asaas do condomínio:
 *
 *   1. Cria via `POST /accounts` (master apiKey).
 *   2. Persiste com `apiKey` criptografada + `webhookToken` gerado.
 *   3. Configura webhook na subconta apontando para o backend.
 *   4. Busca link de onboarding para envio de docs.
 *
 * **Idempotência**: chamar `create()` duas vezes para o mesmo condomínio
 * lança 409 se já existir subconta. Use `refresh()` para atualizar status.
 *
 * **Segredos**: a `apiKey` da subconta nunca sai deste service — quem
 * precisa usar (futuros services de customer, charge, webhook) chama
 * `resolveApiKey()` que retorna o plaintext só pelo tempo do request.
 */
@Injectable()
export class PaymentAccountsService {
  constructor(
    private readonly repo: PaymentAccountsRepository,
    private readonly asaas: AsaasClient,
    private readonly crypto: PaymentEncryptionService,
    private readonly config: ConfigService<Env, true>,
    @InjectPinoLogger(PaymentAccountsService.name)
    private readonly logger: PinoLogger,
  ) {}

  // ── Comandos ──────────────────────────────────────────────────────────────

  /**
   * Cria a subconta no Asaas, persiste local, registra webhook e busca link
   * de onboarding. Operação não atômica: se algum passo pós-`POST /accounts`
   * falha, marcamos como `PENDING_DOCS` mesmo sem onboarding URL — o usuário
   * pode resolver depois com `refreshOnboardingLink`.
   */
  async create(
    condominiumId: string,
    dto: CreatePaymentAccountDto,
  ): Promise<CreatePaymentAccountResponseDto> {
    const existing = await this.repo.findByCondominiumId(condominiumId);
    if (existing && existing.status !== PaymentAccountStatus.REJECTED) {
      throw new ConflictException(
        'Este condomínio já possui uma subconta de pagamento.',
      );
    }

    this.assertHolderTypeConsistency(dto);

    // Pré-check: Asaas exige `cpfCnpj` único entre todas as subcontas da
    // nossa master. Antes de fazer `POST /accounts`, consultamos pra dar
    // uma mensagem útil ao síndico — e poupar quota (sandbox 20/dia).
    await this.assertCpfCnpjAvailable(dto.cpfCnpj, condominiumId);

    // 1) Cria a subconta no Asaas (master apiKey).
    const asaasResp = await this.asaas.createSubaccount({
      name: dto.legalName,
      email: dto.email,
      cpfCnpj: dto.cpfCnpj,
      mobilePhone: dto.mobilePhone,
      incomeValue: dto.incomeValue,
      birthDate:
        dto.holderType === PaymentAccountHolderType.PF
          ? dto.birthDate
          : undefined,
      address: dto.address.street,
      addressNumber: dto.address.number,
      complement: dto.address.complement,
      province: dto.address.province,
      postalCode: dto.address.postalCode,
    });

    // 2) Gera webhook token (32 bytes hex). Sem isso, qualquer um poderia
    //    forjar callback se descobrir a URL pública.
    const webhookToken = randomBytes(32).toString('hex');

    // 3) Tenta registrar o webhook NA SUBCONTA já. Falha aqui é tolerada
    //    (vamos retry no refresh); evita criar subconta órfã.
    try {
      await this.registerWebhook(asaasResp.apiKey, webhookToken, dto.email);
    } catch (err) {
      this.logger.warn(
        { condominiumId, err_message: (err as Error).message },
        'asaas.subaccount.webhook_register_failed',
      );
    }

    // 4) Persiste local com a apiKey já criptografada.
    const encrypted = this.crypto.encrypt(asaasResp.apiKey);
    const account =
      existing ??
      this.repo.create({
        condominiumId,
      });
    Object.assign(account, {
      condominiumId,
      holderType: dto.holderType,
      holderCpfCnpj: dto.cpfCnpj,
      holderLegalName: dto.legalName,
      holderBirthDate: dto.birthDate ?? null,
      holderEmail: dto.email,
      holderMobilePhone: dto.mobilePhone,
      holderIncomeValue: dto.incomeValue.toFixed(2),
      holderAddress: { ...dto.address },
      asaasAccountId: asaasResp.id,
      asaasWalletId: asaasResp.walletId,
      asaasApiKey: encrypted,
      asaasWebhookToken: webhookToken,
      status: PaymentAccountStatus.PENDING_DOCS,
      commercialInfoStatus: PaymentAccountApprovalStatus.PENDING,
      bankAccountInfoStatus: PaymentAccountApprovalStatus.PENDING,
      documentationStatus: PaymentAccountApprovalStatus.AWAITING_DOCS,
      rejectReason: null,
      onboardingUrl: null,
      lastStatusCheckAt: new Date(),
    });
    const saved = await this.repo.save(account);

    // 5) Busca link de onboarding (não crítico). Se falhar, dá pra atualizar
    //    depois via `refreshOnboardingLink`.
    try {
      const link = await this.asaas.getOnboardingLink(asaasResp.apiKey);
      saved.onboardingUrl = link.url ?? null;
      await this.repo.save(saved);
    } catch (err) {
      this.logger.warn(
        { condominiumId, err_message: (err as Error).message },
        'asaas.subaccount.onboarding_link_failed',
      );
    }

    return {
      ...this.toDto(saved),
      message:
        'Subconta criada. A apiKey foi armazenada com segurança e não está disponível na resposta.',
    };
  }

  /**
   * Re-consulta status na Asaas e atualiza local. Quando os 3 indicadores
   * (commercialInfo + bankAccountInfo + documentation) estão `APPROVED`,
   * promove o `status` local para `ACTIVE`.
   *
   * Retorna 404 quando não há subconta — a UI deve sugerir criar.
   */
  async refresh(condominiumId: string): Promise<PaymentAccountResponseDto> {
    const account = await this.getAccountOrFail(condominiumId);
    const apiKey = this.crypto.decrypt(account.asaasApiKey);
    const status = await this.asaas.getAccountStatus(apiKey);
    this.applyAsaasStatus(account, status);
    account.lastStatusCheckAt = new Date();
    const saved = await this.repo.save(account);
    return this.toDto(saved);
  }

  /**
   * Gera um link de onboarding novo (a URL anterior expira em poucas horas).
   * Útil pro frontend mostrar "Reenviar link" quando o síndico perde o e-mail.
   */
  async refreshOnboardingLink(
    condominiumId: string,
  ): Promise<PaymentAccountResponseDto> {
    const account = await this.getAccountOrFail(condominiumId);
    if (account.status === PaymentAccountStatus.ACTIVE) {
      throw new BadRequestException(
        'Subconta já está ativa — link de onboarding não é mais necessário.',
      );
    }
    const apiKey = this.crypto.decrypt(account.asaasApiKey);
    const link = await this.asaas.getOnboardingLink(apiKey);
    account.onboardingUrl = link.url ?? null;
    const saved = await this.repo.save(account);
    return this.toDto(saved);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  /** Versão pública (sem segredos) — usado por controllers. */
  async getStatus(
    condominiumId: string,
  ): Promise<PaymentAccountResponseDto | null> {
    const account = await this.repo.findByCondominiumId(condominiumId);
    return account ? this.toDto(account) : null;
  }

  /**
   * Resolve a `apiKey` em plaintext apenas para uso interno (CustomersService,
   * ChargesService etc.). **Nunca expor essa string em response/log.**
   */
  async resolveApiKey(condominiumId: string): Promise<string> {
    const account =
      await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) {
      throw new NotFoundException('Subconta de pagamento não encontrada.');
    }
    return this.crypto.decrypt(account.asaasApiKey);
  }

  /**
   * Back-office master: devolve credenciais da subconta para debug/integração.
   * **Nunca** usar em endpoints do PWA do síndico — só `MasterRoleGuard`.
   */
  async getSecretsByAccountId(accountId: string): Promise<{
    paymentAccountId: string;
    condominiumId: string;
    asaasAccountId: string;
    asaasWalletId: string;
    asaasApiKey: string;
    asaasWebhookToken: string;
  }> {
    const account = await this.repo.findByIdWithSecrets(accountId);
    if (!account) {
      throw new NotFoundException('Subconta de pagamento não encontrada.');
    }
    this.logger.warn(
      { paymentAccountId: account.id, condominiumId: account.condominiumId },
      'master: credenciais da subconta Asaas consultadas',
    );
    return {
      paymentAccountId: account.id,
      condominiumId: account.condominiumId,
      asaasAccountId: account.asaasAccountId,
      asaasWalletId: account.asaasWalletId,
      asaasApiKey: this.crypto.decrypt(account.asaasApiKey),
      asaasWebhookToken: account.asaasWebhookToken,
    };
  }

  /**
   * Pré-flight do `ChargesService`: bloqueia geração quando a subconta não
   * está ativa (RN-PG-03.1).
   */
  async requireActive(condominiumId: string): Promise<PaymentAccount> {
    const account =
      await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) {
      throw new ForbiddenException(
        'Condomínio sem subconta de pagamento configurada. Configure no setup antes de gerar cobranças.',
      );
    }
    if (account.status !== PaymentAccountStatus.ACTIVE) {
      throw new ForbiddenException(
        `Subconta em status "${account.status}" — pagamentos não habilitados.`,
      );
    }
    return account;
  }

  // ── Manutenção dos webhooks Asaas ─────────────────────────────────────────

  /**
   * Lista de eventos atualmente exigidos pelo CondoSync. Ao adicionar um
   * evento novo no `registerWebhook`, atualize aqui também — o
   * `refreshWebhookForCondominium` compara contra essa lista e regista
   * de novo quando algum evento estiver faltando na subconta existente.
   */
  private static readonly REQUIRED_WEBHOOK_EVENTS: readonly string[] = [
    'PAYMENT_CREATED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_RECEIVED',
    'PAYMENT_OVERDUE',
    'PAYMENT_DELETED',
    'PAYMENT_REFUNDED',
    'PAYMENT_RESTORED',
    'PAYMENT_RECEIVED_IN_CASH',
    'PAYMENT_RECEIVED_IN_CASH_UNDONE',
  ];

  /**
   * Garante que a subconta tem um webhook com todos os eventos exigidos.
   * Se já existe um webhook na URL CondoSync com a lista certa, no-op.
   * Caso contrário, deleta os obsoletos e cria um novo.
   *
   * Retorna `true` se houve mudança (criou/recriou), `false` se já estava OK.
   */
  async refreshWebhookForCondominium(condominiumId: string): Promise<boolean> {
    const account =
      await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) return false;
    const apiKey = this.crypto.decrypt(account.asaasApiKey);
    const baseUrl =
      this.config.get('ASAAS_WEBHOOK_PUBLIC_BASE_URL', { infer: true }) ?? '';
    if (!baseUrl) return false;
    const expectedUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/integrations/asaas/webhook`;
    const required = new Set(PaymentAccountsService.REQUIRED_WEBHOOK_EVENTS);

    let list;
    try {
      list = await this.asaas.listWebhooks(apiKey);
    } catch (err) {
      this.logger.warn(
        { condominiumId, err_message: (err as Error).message },
        'asaas.subaccount.list_webhooks_failed',
      );
      return false;
    }
    const matching = list.data.filter((wh) => wh.url === expectedUrl);
    const ok = matching.find((wh) => {
      const evts = new Set(wh.events ?? []);
      return [...required].every((e) => evts.has(e as AsaasWebhookEvent));
    });
    if (ok) return false;

    // Limpa webhooks antigos da nossa URL (sem todos os eventos) — evita
    // duplicação. Falha individual é só log.
    for (const stale of matching) {
      try {
        await this.asaas.deleteWebhook(apiKey, stale.id);
      } catch (err) {
        this.logger.warn(
          {
            condominiumId,
            webhookId: stale.id,
            err_message: (err as Error).message,
          },
          'asaas.subaccount.delete_stale_webhook_failed',
        );
      }
    }
    await this.registerWebhook(
      apiKey,
      account.asaasWebhookToken,
      account.holderEmail,
    );
    this.logger.info({ condominiumId }, 'asaas.subaccount.webhook_refreshed');
    return true;
  }

  /**
   * Iter sobre todas as subcontas ATIVAS e garante webhooks atualizados.
   * Idempotente — pode ser disparado por cron ou ação master.
   */
  async refreshAllWebhooks(): Promise<{ checked: number; refreshed: number }> {
    const accounts = await this.repo.findAllActive();
    let refreshed = 0;
    for (const acc of accounts) {
      try {
        const changed = await this.refreshWebhookForCondominium(
          acc.condominiumId,
        );
        if (changed) refreshed += 1;
      } catch (err) {
        this.logger.warn(
          {
            condominiumId: acc.condominiumId,
            err_message: (err as Error).message,
          },
          'asaas.subaccount.refresh_failed',
        );
      }
    }
    return { checked: accounts.length, refreshed };
  }

  // ── Helpers internos ──────────────────────────────────────────────────────

  private async getAccountOrFail(
    condominiumId: string,
  ): Promise<PaymentAccount> {
    const account =
      await this.repo.findByCondominiumIdWithSecrets(condominiumId);
    if (!account) {
      throw new NotFoundException('Subconta de pagamento não encontrada.');
    }
    return account;
  }

  /**
   * Verifica se o cpfCnpj já está vinculado a outra subconta:
   *
   *   1. **Localmente** — outro condomínio do nosso tenant já usa esse CPF.
   *      Lança 409 com mensagem clara (sem queimar quota Asaas).
   *   2. **Na Asaas** — `GET /accounts?cpfCnpj=...` retorna pelo menos 1 hit
   *      que NÃO corresponde ao condomínio atual. Lança 409.
   *
   * Pular o pre-check em produção quando `ASAAS_ACCOUNTS_ENABLED=false`
   * não acontece — esse método só é chamado dentro de `create()` que já
   * depende do client habilitado.
   */
  private async assertCpfCnpjAvailable(
    cpfCnpj: string,
    currentCondominiumId: string,
  ): Promise<void> {
    // 1) Local. `holder_cpf_cnpj` não tem UNIQUE no schema (REJECTED pode
    //    retentar com mesmo CPF), então usamos query dedicada no repo.
    const localHits = await this.repo.countByCpfCnpj(
      cpfCnpj,
      currentCondominiumId,
    );
    if (localHits > 0) {
      throw new ConflictException(
        'Este CPF/CNPJ já é o titular de outra conta digital de outro ' +
          'condomínio no CondoSync. Cada condomínio precisa de uma conta ' +
          'digital separada (CPF do síndico OU CNPJ do condomínio). ' +
          'Sugestão: use o CNPJ do condomínio se ele for PJ, ou o CPF de ' +
          'um subsíndico/conselheiro como titular.',
      );
    }

    // 2) Asaas. Catch silencioso em falha de rede — não bloqueamos a
    //    criação por uma indisponibilidade no pré-check; o `POST /accounts`
    //    ainda pegaria o erro de duplicata via `asaasCpfCnpjInUse`.
    try {
      const list = await this.asaas.listSubaccounts({ cpfCnpj, limit: 1 });
      if (list.totalCount > 0 || list.data.length > 0) {
        const hit = list.data[0];
        this.logger.warn(
          {
            cpfCnpjPrefix: cpfCnpj.slice(0, 3) + '***',
            asaasAccountId: hit?.id,
          },
          'asaas.subaccount.cpf_in_use_precheck',
        );
        throw new ConflictException(
          'Este CPF/CNPJ já tem uma conta digital ativa (regra do Banco ' +
            'Central — uma conta por CPF/CNPJ). Use o CNPJ do condomínio ' +
            'se for PJ, o CPF de um subsíndico/conselheiro, ou peça ao ' +
            'titular para encerrar a conta existente em asaas.com.',
        );
      }
    } catch (err) {
      // ConflictException nossa: re-throw.
      if (err instanceof ConflictException) throw err;
      // Outros (rede, 5xx) — log e segue. POST /accounts pega o erro definitivo.
      this.logger.warn(
        { err_message: (err as Error).message },
        'asaas.subaccount.precheck_failed_continuing',
      );
    }
  }

  private assertHolderTypeConsistency(dto: CreatePaymentAccountDto): void {
    const digits = dto.cpfCnpj.length;
    if (dto.holderType === PaymentAccountHolderType.PF && digits !== 11) {
      throw new BadRequestException(
        'holderType=PF exige cpfCnpj com 11 dígitos (CPF).',
      );
    }
    if (dto.holderType === PaymentAccountHolderType.PJ && digits !== 14) {
      throw new BadRequestException(
        'holderType=PJ exige cpfCnpj com 14 dígitos (CNPJ).',
      );
    }
    // MEI aceita tanto CPF (autônomo) quanto CNPJ — não bloqueamos.
    if (dto.holderType === PaymentAccountHolderType.PF && !dto.birthDate) {
      throw new BadRequestException(
        'birthDate é obrigatório para holderType=PF.',
      );
    }
  }

  /**
   * Mapeia os 4 statuses do Asaas para o `PaymentAccount` local. Lógica:
   *
   *   - Todos os 3 indicadores `APPROVED` → `status = ACTIVE`
   *   - Qualquer um `REJECTED` → `status = REJECTED` (com motivo, se houver)
   *   - Algum `AWAITING_DOCUMENTS` → `status = PENDING_DOCS`
   *   - Senão → `status = PENDING_REVIEW`
   */
  private applyAsaasStatus(
    account: PaymentAccount,
    s: AsaasAccountStatusResponse,
  ): void {
    account.commercialInfoStatus = this.mapApprovalStatus(s.commercialInfo);
    account.bankAccountInfoStatus = this.mapApprovalStatus(s.bankAccountInfo);
    account.documentationStatus = this.mapApprovalStatus(s.documentation);

    const all = [s.commercialInfo, s.bankAccountInfo, s.documentation];
    if (all.every((x) => x === 'APPROVED')) {
      account.status = PaymentAccountStatus.ACTIVE;
      account.rejectReason = null;
    } else if (all.some((x) => x === 'REJECTED')) {
      account.status = PaymentAccountStatus.REJECTED;
      account.rejectReason = s.rejectReason ?? account.rejectReason;
    } else if (
      all.some((x) => x === 'AWAITING_DOCUMENTS' || x === 'AWAITING_APPROVAL')
    ) {
      account.status = PaymentAccountStatus.PENDING_DOCS;
    } else {
      account.status = PaymentAccountStatus.PENDING_REVIEW;
    }
  }

  private mapApprovalStatus(
    raw: AsaasAccountApprovalStatus,
  ): PaymentAccountApprovalStatus {
    switch (raw) {
      case 'APPROVED':
        return PaymentAccountApprovalStatus.APPROVED;
      case 'REJECTED':
        return PaymentAccountApprovalStatus.REJECTED;
      case 'AWAITING_DOCUMENTS':
      case 'AWAITING_APPROVAL':
        return PaymentAccountApprovalStatus.AWAITING_DOCS;
      case 'PENDING':
      default:
        return PaymentAccountApprovalStatus.PENDING;
    }
  }

  private async registerWebhook(
    apiKey: string,
    authToken: string,
    email: string,
  ): Promise<void> {
    const baseUrl =
      this.config.get('ASAAS_WEBHOOK_PUBLIC_BASE_URL', { infer: true }) ?? '';
    if (!baseUrl) {
      throw new BadRequestException(
        'ASAAS_WEBHOOK_PUBLIC_BASE_URL não configurado — necessário para registrar webhook.',
      );
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/integrations/asaas/webhook`;
    await this.asaas.createWebhook(apiKey, {
      name: 'CondoSync',
      url,
      email,
      enabled: true,
      sendType: 'SEQUENTIALLY',
      authToken,
      // Doc oficial (`interrupted`) + nome novo exigido pelo servidor desde
      // mai/2026 (`poolInterrupted`). Ambos `false` = não pausar a fila.
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
        // Disparados quando o síndico baixa manualmente no CondoSync (via
        // `receiveInCash`) — backend usa para auditoria; status local já
        // está PAID. UNDONE reverte para PENDING se a baixa é desfeita.
        'PAYMENT_RECEIVED_IN_CASH',
        'PAYMENT_RECEIVED_IN_CASH_UNDONE',
      ],
    });
  }

  private toDto(account: PaymentAccount): PaymentAccountResponseDto {
    return {
      id: account.id,
      condominiumId: account.condominiumId,
      holderType: account.holderType,
      holderCpfCnpjMasked: this.maskCpfCnpj(account.holderCpfCnpj),
      holderLegalName: account.holderLegalName,
      status: account.status,
      commercialInfoStatus: account.commercialInfoStatus,
      bankAccountInfoStatus: account.bankAccountInfoStatus,
      documentationStatus: account.documentationStatus,
      rejectReason: account.rejectReason,
      onboardingUrl: account.onboardingUrl,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastStatusCheckAt: account.lastStatusCheckAt,
    };
  }

  /** `12345678901` → `123.***.***-01`. Não-invertível. */
  private maskCpfCnpj(value: string): string {
    if (value.length === 11) {
      return `${value.slice(0, 3)}.***.***-${value.slice(-2)}`;
    }
    if (value.length === 14) {
      return `${value.slice(0, 2)}.***.***/****-${value.slice(-2)}`;
    }
    return '***';
  }
}
