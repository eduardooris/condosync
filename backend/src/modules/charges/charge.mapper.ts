import { Charge } from '../../database/entities/charge.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { ChargeStatus } from '../../common/enums';
import { ChargeResponseDto } from './dto/charge-response.dto';
import { buildPixBrCode } from './pix-brcode';

const PIX_ELIGIBLE_STATUS = new Set<ChargeStatus>([
  ChargeStatus.PENDING,
  ChargeStatus.OVERDUE,
]);

/**
 * Constrói a resposta HTTP de uma cobrança, anexando o BR Code Pix
 * quando o condomínio tem chave configurada e a cobrança está em
 * aberto. Sem o condomínio, retorna `pixCode: null` (situação
 * frequente em listagens administrativas que não carregam o agregado
 * para evitar n+1).
 */
export const toChargeResponse = (
  charge: Charge,
  condominium?: Condominium | null,
): ChargeResponseDto => {
  let pixCode: string | null = null;
  if (condominium && PIX_ELIGIBLE_STATUS.has(charge.status)) {
    pixCode = buildPixBrCode({
      pixKeyType: condominium.pixKeyType,
      pixKeyValue: condominium.pixKeyValue,
      receiverName: condominium.name,
      receiverCity: 'BRASIL',
      amount: charge.amount,
      txId: `${charge.billingMonth}-${charge.id.slice(0, 6)}`,
    });
  }

  return {
    id: charge.id,
    unitId: charge.unitId,
    billingMonth: charge.billingMonth,
    amount: charge.amount,
    dueDate: charge.dueDate,
    description: charge.description,
    status: charge.status,
    paidAt: charge.paidAt,
    paidMethod: charge.paidMethod,
    paidNote: charge.paidNote,
    exemptReason: charge.exemptReason,
    canceledAt: charge.canceledAt,
    cancelReason: charge.cancelReason,
    createdAt: charge.createdAt,
    updatedAt: charge.updatedAt,
    pixCode,
    asaasPaymentId: charge.asaasPaymentId,
    asaasInvoiceUrl: charge.asaasInvoiceUrl,
    asaasPixPayload: charge.asaasPixPayload,
    asaasPixQrBase64: charge.asaasPixQrBase64,
    asaasBankSlipUrl: charge.asaasBankSlipUrl,
    asaasTransactionReceiptUrl: charge.asaasTransactionReceiptUrl,
    asaasPaidVia: charge.asaasPaidVia,
    asaasLastEvent: charge.asaasLastEvent,
    asaasSyncedAt: charge.asaasSyncedAt,
  };
};
