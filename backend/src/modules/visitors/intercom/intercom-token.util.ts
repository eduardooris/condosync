import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const INTERCOM_TOKEN_BYTES = 32;

export function hashIntercomToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateIntercomToken(): string {
  return randomBytes(INTERCOM_TOKEN_BYTES).toString('base64url');
}

export function timingSafeTokenMatch(
  raw: string,
  expectedHash: string,
): boolean {
  const actual = hashIntercomToken(raw);
  try {
    return timingSafeEqual(
      Buffer.from(actual, 'hex'),
      Buffer.from(expectedHash, 'hex'),
    );
  } catch {
    return false;
  }
}

export function formatUnitLabel(block: string, number: string): string {
  const b = block?.trim();
  const n = number?.trim();
  if (b && n) return `Bloco ${b} · ${n}`;
  if (n) return n;
  return b || 'Unidade';
}
