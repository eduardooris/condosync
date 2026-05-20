/** Alinhado a `MANUAL_PAID_METHODS` no backend (`mark-paid.dto.ts`). */
export const MANUAL_PAID_METHODS = [
  { value: 'MANUAL_CASH', label: 'Dinheiro' },
  { value: 'MANUAL_PIX', label: 'Pix (fora do link Asaas)' },
  { value: 'MANUAL_TRANSFER', label: 'Transferência bancária' },
  { value: 'MANUAL_BOLETO', label: 'Boleto depositado' },
  { value: 'MANUAL_OTHER', label: 'Outro' },
] as const;

export type ManualPaidMethod = (typeof MANUAL_PAID_METHODS)[number]['value'];
