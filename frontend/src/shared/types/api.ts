import type { components } from '@/shared/types/openapi.generated';

export type MeResponse = components['schemas']['MeResponseDto'];
export type Condominium = components['schemas']['CondominiumResponseDto'];
export type Unit = components['schemas']['UnitResponseDto'];
export type Resident = components['schemas']['ResidentResponseDto'];
export type Charge = components['schemas']['ChargeResponseDto'];
export type Expense = components['schemas']['ExpenseResponseDto'];
export type Bulletin = components['schemas']['BulletinResponseDto'];
export type Occurrence = components['schemas']['OccurrenceResponseDto'];
export type Poll = components['schemas']['PollResponseDto'];
export type PollResult = components['schemas']['PollResultsResponseDto'];
export type PollMyParticipationItem = {
  pollId: string;
  canVote: boolean;
  hasVoted: boolean;
  selectedOptionId: string | null;
};
export type Document = components['schemas']['DocumentResponseDto'];

export type {
  IntercomSessionStatus,
  PortariaUnit,
  CreateIntercomSessionResponse,
} from '@/shared/types/intercom';
