const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatChargeBillingMonth(billingMonth: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(billingMonth ?? '');
  if (!m) return billingMonth;
  const month = MONTHS_PT[Number(m[2]) - 1] ?? m[2];
  return `${month}/${m[1]}`;
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` sem usar Date (fuso). */
export function formatChargeDueDate(dueDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate ?? '');
  if (!m) return dueDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function pixKeyTypeLabel(
  type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP' | string | null | undefined,
): string {
  switch (type) {
    case 'CPF':
      return 'CPF';
    case 'CNPJ':
      return 'CNPJ';
    case 'EMAIL':
      return 'E-mail';
    case 'PHONE':
      return 'Telefone';
    case 'EVP':
      return 'Chave aleatória';
    default:
      return 'Chave Pix';
  }
}

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/** Dígitos BR (10/11) → wa.me com prefixo 55. */
export function whatsappAdminHref(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw);
  if (d.length !== 10 && d.length !== 11) return null;
  const br = d.startsWith('55') ? d : `55${d}`;
  return `https://wa.me/${br}`;
}

export function telAdminHref(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw);
  if (d.length !== 10 && d.length !== 11) return null;
  const br = d.startsWith('55') ? d : `55${d}`;
  return `tel:+${br}`;
}
