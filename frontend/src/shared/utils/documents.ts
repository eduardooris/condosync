import {
  digitsOnly,
  formatMobilePhoneLocalDisplay,
} from '@/shared/utils/phone';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

export type CpfCnpjHolderKind = 'PF' | 'MEI' | 'PJ';

/** CPF: 000.000.000-00 */
export function formatCpf(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** CNPJ: 00.000.000/0000-00 */
export function formatCnpj(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Máscara adaptativa: até 11 dígitos formata como CPF; a partir do 12º, como CNPJ.
 * Usado quando o campo aceita CPF ou CNPJ (ex.: identidade do condomínio no setup).
 */
export function formatCpfOrCnpj(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 14);
  if (digits.length <= 11) return formatCpf(digits);
  return formatCnpj(digits);
}

/** Máscara conforme tipo de titular da subconta Asaas (MEI usa CPF). */
export function formatCpfCnpjByHolder(
  raw: string,
  holder: CpfCnpjHolderKind,
): string {
  return holder === 'PJ' ? formatCnpj(raw) : formatCpf(raw);
}

/** Máscara do valor da chave Pix conforme o tipo selecionado. */
export function formatPixKeyValue(type: PixKeyType, raw: string): string {
  switch (type) {
    case 'CPF':
      return formatCpf(raw);
    case 'CNPJ':
      return formatCnpj(raw);
    case 'PHONE':
      return formatMobilePhoneLocalDisplay(raw);
    default:
      return raw;
  }
}

/** Valor sem máscara para persistir na API (CPF/CNPJ/telefone). */
export function normalizePixKeyValue(type: PixKeyType, raw: string): string {
  if (type === 'CPF' || type === 'CNPJ' || type === 'PHONE') {
    return digitsOnly(raw);
  }
  return raw.trim();
}
