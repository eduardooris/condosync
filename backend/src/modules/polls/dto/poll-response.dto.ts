import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PollStatus } from '../../../common/enums';

export class PollOptionResponseDto {
  @ApiProperty({ example: 'opt-1' })
  id: string;

  @ApiProperty({ example: 'ad4ecfa0-e2dc-4b66-8af2-fc71ab6bc9f4' })
  pollId: string;

  @ApiProperty({ example: 'Sim' })
  label: string;

  @ApiProperty({ example: 0 })
  sortOrder: number;

  /**
   * Quantidade de votos nesta opção. Vale `0` para enquetes em aberto
   * em que o usuário ainda não votou (RN-04.3 — não vazar resultado
   * parcial). Após o voto ou encerramento, vem populado.
   */
  @ApiProperty({ example: 12 })
  votes: number;
}

export class PollResponseDto {
  @ApiProperty({ example: 'ad4ecfa0-e2dc-4b66-8af2-fc71ab6bc9f4' })
  id: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ example: 'Aprovar pintura da fachada' })
  title: string;

  @ApiPropertyOptional({ example: 'Pintura externa bloco A/B', nullable: true })
  description: string | null;

  @ApiProperty({ example: '50.00' })
  quorumPercent: string;

  @ApiProperty({ example: '2026-05-15T23:59:59.000Z' })
  closesAt: Date;

  @ApiPropertyOptional({ example: null, nullable: true })
  closedAt: Date | null;

  @ApiProperty({ example: true })
  isAnonymous: boolean;

  @ApiProperty({ enum: PollStatus, example: PollStatus.OPEN })
  status: PollStatus;

  @ApiPropertyOptional({
    example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886',
    nullable: true,
  })
  createdByUserId: string | null;

  @ApiProperty({ type: [PollOptionResponseDto] })
  options: PollOptionResponseDto[];

  /** Total de votos. Sempre exposto, mesmo em enquetes abertas. */
  @ApiProperty({ example: 18 })
  totalVotes: number;

  /**
   * Opção em que a unidade do usuário autenticado votou; `null` se
   * ainda não votou ou se ele não é responsável financeiro.
   */
  @ApiPropertyOptional({ example: 'opt-1', nullable: true })
  voted: string | null;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  updatedAt: Date;
}

/**
 * RN-04.1 — em enquetes anônimas, `unitId` e `votedByResidentId` são
 * mascarados (`null`). Eles continuam persistidos para garantir o
 * UNIQUE `(poll_id, unit_id)`, mas nunca são expostos ao cliente.
 */
export class PollVoteResponseDto {
  @ApiProperty({
    example: 'vote-1',
    description: 'Identificador do voto.',
  })
  id: string;

  @ApiProperty({
    example: 'ad4ecfa0-e2dc-4b66-8af2-fc71ab6bc9f4',
    description: 'ID da enquete.',
  })
  pollId: string;

  @ApiPropertyOptional({
    example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0',
    nullable: true,
    description: 'ID da unidade votante. `null` quando a enquete é anônima.',
  })
  unitId: string | null;

  @ApiProperty({
    example: 'opt-1',
    description: 'ID da opção escolhida.',
  })
  optionId: string;

  @ApiPropertyOptional({
    example: 'res-1',
    nullable: true,
    description:
      'ID do morador responsável que votou. `null` quando a enquete é anônima.',
  })
  votedByResidentId: string | null;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  createdAt: Date;
}

export class PollResultsResponseDto {
  @ApiProperty({ example: 'ad4ecfa0-e2dc-4b66-8af2-fc71ab6bc9f4' })
  pollId: string;

  @ApiProperty({ example: 'Aprovar pintura da fachada' })
  title: string;

  @ApiProperty({ example: 18 })
  totalVotes: number;

  @ApiProperty({ example: 30 })
  totalOccupiedUnits: number;

  @ApiProperty({ example: '50.00' })
  quorumPercent: string;

  @ApiProperty({
    example: true,
    description:
      'Indica se a participação atingiu o quórum mínimo configurado (RN-04.2).',
  })
  quorumReached: boolean;

  @ApiProperty({
    example: { 'opt-1': 12, 'opt-2': 6 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  counts: Record<string, number>;
}
