import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Env } from '../../../config/env.schema';
import { Charge } from '../../../database/entities/charge.entity';
import { Unit } from '../../../database/entities/unit.entity';
import { Resident } from '../../../database/entities/resident.entity';
import { AsaasClient } from '../asaas/asaas.client';
import { AsaasSplit } from '../asaas/asaas.types';
import { PaymentAccountsService } from '../accounts/payment-accounts.service';
import { PaymentCustomersService } from '../customers/payment-customers.service';

/**
 * Bridge ChargesService → Asaas. Mantém o domínio de `charges` ignorante
 * do gateway: o `ChargesService` chama estes métodos com a charge já
 * persistida localmente, e a gente cuida de:
 *
 *   - resolver subconta + apiKey + customer
 *   - emitir `POST /payments` com idempotência via `externalReference`
 *   - gravar `asaas_*` na charge
 *   - cancelar/excluir no Asaas em transições EXEMPT / CANCELED
 *
 * Failure modes:
 *   - Subconta não-ativa → 403 (block charge generation antes de chamar isso)
 *   - Customer não existe → tentativa de criar; se falhar, 500
 *   - Asaas timeout → AsaasException já mapeado pelo client
 */
@Injectable()
export class ChargesAsaasService {
  constructor(
    @InjectRepository(Charge)
    private readonly chargeRepo: Repository<Charge>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    private readonly asaas: AsaasClient,
    private readonly accounts: PaymentAccountsService,
    private readonly customers: PaymentCustomersService,
    private readonly config: ConfigService<Env, true>,
    @InjectPinoLogger(ChargesAsaasService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Emite uma cobrança na Asaas para o pagador correto (responsável
   * financeiro da unidade). Atualiza a charge local com `asaas_*`.
   *
   * Pré-condições (caller garante):
   *   - Charge já salva localmente (status PENDING)
   *   - Unidade pertence ao condomínio
   *   - Subconta ACTIVE (via `PaymentAccountsService.requireActive`)
   */
  async emitPayment(charge: Charge): Promise<Charge> {
    const unit = charge.unit ?? (await this.loadUnitWithCondo(charge.unitId));
    const condominiumId = unit.condominiumId;

    // 1) Resolve responsável financeiro atual da unidade.
    const responsible = await this.residentRepo.findOne({
      where: { unitId: unit.id, isFinancialResponsible: true },
    });
    if (!responsible) {
      throw new ForbiddenException(
        `Unidade ${unit.block}-${unit.number} sem responsável financeiro — não emite cobrança.`,
      );
    }

    // 2) Resolve Customer Asaas (cria se ainda não existe — idempotente).
    const customer = await this.customers.ensureForResponsible(condominiumId, {
      id: responsible.id,
      cpf: responsible.cpf,
      fullName: responsible.fullName,
      email: responsible.email ?? null,
      phoneWhatsapp: responsible.phoneWhatsapp ?? null,
    });

    // 3) Resolve apiKey da subconta + monta split (se SaaS-fee ligado).
    const apiKey = await this.accounts.resolveApiKey(condominiumId);
    const split = this.buildSplit();

    // 4) Cria Payment na Asaas. Usa `externalReference = charge.id` —
    //    o próprio Asaas garante idempotência por externalRef se reenviado.
    const payment = await this.asaas.createPayment(apiKey, {
      customer: customer.asaasCustomerId,
      billingType: 'UNDEFINED',
      value: Number(charge.amount),
      dueDate: charge.dueDate,
      description: this.buildDescription(charge, unit),
      externalReference: charge.id,
      ...(split.length > 0 ? { split } : {}),
    });

    // 5) Persiste retorno na charge.
    charge.asaasPaymentId = payment.id;
    charge.asaasInvoiceUrl = payment.invoiceUrl;
    charge.asaasBankSlipUrl = payment.bankSlipUrl;
    charge.asaasSyncedAt = new Date();
    charge.asaasLastEvent = 'PAYMENT_CREATED';

    return this.chargeRepo.save(charge);
  }

  /**
   * Liquida a cobrança na Asaas como "recebida em dinheiro" — preserva
   * histórico contábil e dispara `PAYMENT_RECEIVED_IN_CASH` no webhook.
   *
   * Usado pelo `markPaid` do síndico quando a baixa é por Pix fora do
   * gateway, dinheiro, transferência etc. — qualquer método que NÃO seja
   * `MANUAL_OTHER` (correção/duplicidade).
   *
   * Lança exceção: o caller (`ChargesService.markPaid`) decide se aborta
   * a baixa local — atualmente abortamos, pra evitar inconsistência entre
   * dashboard local "PAGO" e Asaas "PENDING".
   */
  async settleAsReceivedInCash(charge: Charge, paidAt: Date): Promise<Charge> {
    if (!charge.asaasPaymentId) return charge;
    const unit = charge.unit ?? (await this.loadUnitWithCondo(charge.unitId));
    const apiKey = await this.accounts.resolveApiKey(unit.condominiumId);
    const paymentDate = this.formatDateForAsaas(paidAt);
    await this.asaas.receivePaymentInCash(apiKey, charge.asaasPaymentId, {
      paymentDate,
      value: Number(charge.amount),
      // Não notificamos o pagador — o morador já sabe que pagou; o
      // CondoSync envia a notif de "cobrança paga" pelo nosso fluxo.
      notifyCustomer: false,
    });
    charge.asaasLastEvent = 'PAYMENT_RECEIVED_IN_CASH';
    charge.asaasSyncedAt = new Date();
    return this.chargeRepo.save(charge);
  }

  /**
   * Cancela a cobrança na Asaas. Usado em `cancel()` e `exempt()` — em
   * ambos os casos não faz sentido manter cobrança ativa lá.
   * Idempotente: se já cancelada ou inexistente, swallow + log.
   */
  async cancelPayment(charge: Charge): Promise<void> {
    if (!charge.asaasPaymentId) return;
    const unit = charge.unit ?? (await this.loadUnitWithCondo(charge.unitId));
    const apiKey = await this.accounts.resolveApiKey(unit.condominiumId);
    try {
      await this.asaas.deletePayment(apiKey, charge.asaasPaymentId);
    } catch (err) {
      // 404 do Asaas (já deletado) ou outro erro: log e segue local.
      this.logger.warn(
        {
          chargeId: charge.id,
          asaasPaymentId: charge.asaasPaymentId,
          err_message: (err as Error).message,
        },
        'asaas.payment.delete_failed',
      );
    }
  }

  /**
   * Lê QR Code Pix sob demanda — cacheamos na charge para evitar GET
   * extras a cada visualização do morador.
   */
  async fetchPixQrCode(
    charge: Charge,
  ): Promise<{ payload: string; qrBase64: string } | null> {
    if (!charge.asaasPaymentId) return null;
    if (charge.asaasPixPayload && charge.asaasPixQrBase64) {
      return {
        payload: charge.asaasPixPayload,
        qrBase64: charge.asaasPixQrBase64,
      };
    }
    const unit = charge.unit ?? (await this.loadUnitWithCondo(charge.unitId));
    const apiKey = await this.accounts.resolveApiKey(unit.condominiumId);
    try {
      const qr = await this.asaas.getPixQrCode(apiKey, charge.asaasPaymentId);
      charge.asaasPixPayload = qr.payload;
      charge.asaasPixQrBase64 = qr.encodedImage;
      await this.chargeRepo.save(charge);
      return { payload: qr.payload, qrBase64: qr.encodedImage };
    } catch (err) {
      // Subconta sem chave Pix configurada cai aqui — não é erro fatal.
      this.logger.warn(
        {
          chargeId: charge.id,
          asaasPaymentId: charge.asaasPaymentId,
          err_message: (err as Error).message,
        },
        'asaas.pix_qr.fetch_failed',
      );
      return null;
    }
  }

  // ── Internas ────────────────────────────────────────────────────────────

  private buildDescription(charge: Charge, unit: Unit): string {
    const monthLabel = this.humanizeMonth(charge.billingMonth);
    const base = `Condomínio · ${unit.block}-${unit.number} · ${monthLabel}`;
    return charge.description?.trim()
      ? `${base} — ${charge.description.trim()}`
      : base;
  }

  private humanizeMonth(yyyyMm: string): string {
    const [y, m] = yyyyMm.split('-');
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    const idx = Number(m) - 1;
    if (idx < 0 || idx > 11 || !y) return yyyyMm;
    return `${months[idx]}/${y}`;
  }

  /**
   * Monta o array de split quando SaaS-fee está habilitado. Lê do env
   * (`ASAAS_DEFAULT_SPLIT_PERCENT` + `ASAAS_SAAS_WALLET_ID`). Quando 0 ou
   * walletId vazio, retorna `[]` — Asaas trata como sem split (100% pra
   * subconta do síndico).
   */
  private buildSplit(): AsaasSplit[] {
    const percent = this.config.get('ASAAS_DEFAULT_SPLIT_PERCENT', {
      infer: true,
    });
    const wallet = this.config.get('ASAAS_SAAS_WALLET_ID', { infer: true });
    if (!percent || percent <= 0 || !wallet) return [];
    return [{ walletId: wallet, percentualValue: percent }];
  }

  /** `YYYY-MM-DD` (formato exigido pelo Asaas em receiveInCash/paymentDate). */
  private formatDateForAsaas(date: Date): string {
    // Usa toISOString → corta a parte da hora. Funciona para qualquer Date
    // pois Asaas só armazena dia. Não precisa converter para America/Sao_Paulo:
    // ainda que o usuário esteja em outro fuso, a baixa de hoje é a baixa do dia.
    return date.toISOString().slice(0, 10);
  }

  private async loadUnitWithCondo(unitId: string): Promise<Unit> {
    const u = await this.unitRepo.findOne({ where: { id: unitId } });
    if (!u) throw new ForbiddenException('Unidade não encontrada.');
    return u;
  }
}
