/** Remove tudo que não for dígito. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formato exigido pela Asaas: `55` + DDD (2) + número (8 ou 9 dígitos).
 * Aceita entrada com ou sem DDI; remove zeros à esquerda do DDD quando sobram.
 */
export function toAsaasMobilePhone(raw: string): string {
  let d = digitsOnly(raw);
  if (!d) return '';

  if (d.startsWith('55')) {
    d = d.slice(2);
  }
  // Ex.: 085991712228 → 85991712228
  while (d.length > 11 && d.startsWith('0')) {
    d = d.slice(1);
  }

  return `55${d}`;
}

export function isValidAsaasMobilePhone(phone: string): boolean {
  return /^55\d{10,11}$/.test(phone);
}

/** Máscara local (sem DDI) para exibição: (85) 99171-2228 */
export function formatMobilePhoneLocalDisplay(raw: string): string {
  let d = digitsOnly(raw);
  if (d.startsWith('55')) d = d.slice(2);
  while (d.length > 11 && d.startsWith('0')) {
    d = d.slice(1);
  }
  if (!d) return '';
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/** Alias usado em formulários de morador/convite (DDD + número, sem DDI). */
export const formatWhatsappInput = formatMobilePhoneLocalDisplay;
