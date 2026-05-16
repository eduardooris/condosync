import { BadRequestException } from '@nestjs/common';
import { IntercomSessionStatus } from '../../../common/enums';

const TRANSITIONS: Record<IntercomSessionStatus, IntercomSessionStatus[]> = {
  [IntercomSessionStatus.INITIATED]: [
    IntercomSessionStatus.RINGING,
    IntercomSessionStatus.CANCELED_BY_VISITOR,
    IntercomSessionStatus.FAILED,
  ],
  [IntercomSessionStatus.RINGING]: [
    IntercomSessionStatus.PREVIEW,
    IntercomSessionStatus.ANSWERED,
    IntercomSessionStatus.MISSED,
    IntercomSessionStatus.CANCELED_BY_VISITOR,
    IntercomSessionStatus.REJECTED,
    IntercomSessionStatus.FAILED,
    IntercomSessionStatus.ENDED,
  ],
  [IntercomSessionStatus.PREVIEW]: [
    IntercomSessionStatus.ANSWERED,
    IntercomSessionStatus.MISSED,
    IntercomSessionStatus.CANCELED_BY_VISITOR,
    IntercomSessionStatus.ENDED,
    IntercomSessionStatus.FAILED,
  ],
  [IntercomSessionStatus.ANSWERED]: [
    IntercomSessionStatus.ENDED,
    IntercomSessionStatus.FAILED,
  ],
  [IntercomSessionStatus.ENDED]: [],
  [IntercomSessionStatus.MISSED]: [],
  [IntercomSessionStatus.CANCELED_BY_VISITOR]: [],
  [IntercomSessionStatus.REJECTED]: [],
  [IntercomSessionStatus.FAILED]: [],
};

export function assertIntercomTransition(
  from: IntercomSessionStatus,
  to: IntercomSessionStatus,
): void {
  if (from === to) {
    return;
  }
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(
      `Transição de sessão inválida: "${from}" → "${to}".`,
    );
  }
}

export function isIntercomTerminal(status: IntercomSessionStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export const INTERCOM_RINGING_STATUSES: IntercomSessionStatus[] = [
  IntercomSessionStatus.INITIATED,
  IntercomSessionStatus.RINGING,
  IntercomSessionStatus.PREVIEW,
];
