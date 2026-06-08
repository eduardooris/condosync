/**
 * Helpers de validação de documentos brasileiros.
 *
 * Importante: usados em RN-02.1 (responsável financeiro precisa ter
 * CPF e WhatsApp válidos antes de salvar).
 */

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida o CPF brasileiro completo: tamanho, dígitos repetidos e os
 * dois dígitos verificadores conforme algoritmo da Receita Federal.
 */
export function isValidCpfDigits(cpf: string): boolean {
  const d = normalizeCpf(cpf);
  if (d.length !== 11) return false;
  if (!/^\d{11}$/.test(d)) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // 11111111111 etc.

  const digits = d.split('').map(Number);
  const calc = (slice: number[], factor: number): number => {
    const sum = slice.reduce((acc, n, i) => acc + n * (factor - i), 0);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const dv1 = calc(digits.slice(0, 9), 10);
  if (dv1 !== digits[9]) return false;
  const dv2 = calc(digits.slice(0, 10), 11);
  return dv2 === digits[10];
}

/**
 * Aceita números brasileiros começando opcionalmente por 55 (DDI),
 * com DDD (2 dígitos) + 8 ou 9 dígitos do número. Ex.: 5511987654321.
 */
export function isValidBrazilWhatsapp(phone: string): boolean {
  const d = phone.replace(/\D/g, '');
  // 55 + 2 (DDD) + 8 ou 9 dígitos = 12-13. Sem DDI = 10-11.
  return d.length >= 10 && d.length <= 13;
}

/**
 * Normaliza para o formato esperado pela Evolution API: `5511987654321`
 * (DDI 55 + DDD + número, sem `+`, parênteses ou hífens).
 */
export function normalizeBrazilWhatsapp(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) {
    return `55${d}`;
  }
  return d;
}

/**
 * Formato exigido pela Asaas em `mobilePhone` (subconta e customer):
 * `55` + DDD (2) + 8 ou 9 dígitos, só dígitos.
 */
export function toAsaasMobilePhone(
  raw: string | null | undefined,
): string | undefined {
  if (!raw?.trim()) return undefined;
  let d = raw.replace(/\D/g, '');
  if (!d) return undefined;
  if (d.startsWith('55')) d = d.slice(2);
  while (d.length > 11 && d.startsWith('0')) {
    d = d.slice(1);
  }
  const out = `55${d}`;
  return /^55\d{10,11}$/.test(out) ? out : undefined;
}

/**
 * Formata um número BR para envio via WhatsApp (whatsmeow / Cloud API).
 *
 * O WhatsApp identifica usuários BR pelo número *sem* o nono dígito de
 * celular adicionado a partir de 2012 (ex.: `558591712228`, não
 * `5585991712228`). Quando o número for de celular BR (DDD + 9 + 8
 * dígitos), removemos o `9`. Telefones fixos (8 dígitos no número) e
 * formatos não-BR ficam intactos.
 *
 * Exemplos:
 *   `+55 (85) 99171-2228` -> `558591712228`
 *   `5585991712228`       -> `558591712228`
 *   `85991712228`         -> `558591712228`
 *   `8533334444`          -> `558533334444` (fixo, mantido)
 */
export function formatBrazilWhatsappForSending(phone: string): string {
  const normalized = normalizeBrazilWhatsapp(phone);
  // Esperado: 55 + DDD(2) + 9 + 8 dígitos = 13 caracteres iniciados em 55.
  if (
    normalized.length === 13 &&
    normalized.startsWith('55') &&
    normalized[4] === '9'
  ) {
    return `${normalized.slice(0, 4)}${normalized.slice(5)}`;
  }
  return normalized;
}

/**
 * Valores possíveis de `residents.phone_whatsapp` no banco para comparar com o
 * que o usuário digitou (com ou sem 9º dígito de celular BR, com/sem DDI 55).
 */
export function whatsappLookupCandidates(input: string): string[] {
  const raw = input.replace(/\D/g, '');
  if (raw.length < 10) return [];

  const normalized = normalizeBrazilWhatsapp(input);
  const forSend = formatBrazilWhatsappForSending(input);
  const set = new Set<string>([normalized, forSend].filter(Boolean));

  if (
    normalized.length === 13 &&
    normalized.startsWith('55') &&
    normalized[4] === '9'
  ) {
    set.add(`${normalized.slice(0, 4)}${normalized.slice(5)}`);
  }
  if (
    normalized.length === 12 &&
    normalized.startsWith('55') &&
    normalized[4] !== '9'
  ) {
    set.add(`${normalized.slice(0, 4)}9${normalized.slice(4)}`);
  }

  return [...set];
}
