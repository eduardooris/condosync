import { digitsOnly } from '@/shared/utils/phone';

/** Máscara 00000-000 (até 8 dígitos). */
export function formatCep(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
