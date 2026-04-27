import { BadRequestException } from '@nestjs/common';
import { ChargeStatus } from '../../common/enums';

/**
 * Máquina de estados para `Charge.status`. Aplica RN-03.2:
 *
 *   PENDING ─┬─► PAID
 *            ├─► EXEMPT
 *            ├─► OVERDUE   (somente via job/scheduler)
 *            └─► CANCELED
 *
 *   OVERDUE ─┬─► PAID
 *            ├─► EXEMPT
 *            └─► CANCELED
 *
 *   PAID     → terminal
 *   EXEMPT   → terminal
 *   CANCELED → terminal
 *
 * Transições inválidas devolvem `BadRequestException` com mensagem
 * em PT-BR para que o front consiga exibir o erro ao usuário.
 */
const TRANSITIONS: Record<ChargeStatus, ChargeStatus[]> = {
  [ChargeStatus.PENDING]: [
    ChargeStatus.PAID,
    ChargeStatus.EXEMPT,
    ChargeStatus.OVERDUE,
    ChargeStatus.CANCELED,
  ],
  [ChargeStatus.OVERDUE]: [
    ChargeStatus.PAID,
    ChargeStatus.EXEMPT,
    ChargeStatus.CANCELED,
  ],
  [ChargeStatus.PAID]: [],
  [ChargeStatus.EXEMPT]: [],
  [ChargeStatus.CANCELED]: [],
};

export function assertChargeTransition(
  from: ChargeStatus,
  to: ChargeStatus,
): void {
  if (from === to) {
    throw new BadRequestException(`Cobrança já está com status "${from}".`);
  }
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `Transição de status inválida: "${from}" → "${to}".`,
    );
  }
}

export function isTerminalStatus(status: ChargeStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
