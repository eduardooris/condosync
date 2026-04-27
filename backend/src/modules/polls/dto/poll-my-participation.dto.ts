import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Resumo de participação do usuário atual em uma enquete (sem revelar
 * resultados agregados enquanto a enquete está aberta — RN-04.3).
 */
export class PollMyParticipationItemDto {
  @ApiProperty({ example: 'ad4ecfa0-e2dc-4b66-8af2-fc71ab6bc9f4' })
  pollId: string;

  @ApiProperty({
    example: true,
    description:
      'Se o usuário logado é o responsável financeiro de uma unidade neste condomínio (pode votar).',
  })
  canVote: boolean;

  @ApiProperty({
    example: true,
    description: 'Se a unidade do responsável já registrou voto nesta enquete.',
  })
  hasVoted: boolean;

  @ApiPropertyOptional({
    example: 'opt-1',
    nullable: true,
    description:
      'Opção escolhida por esta unidade, quando `hasVoted` é true. `null` se ainda não votou ou não pode votar.',
  })
  selectedOptionId: string | null;
}

export class PollMyParticipationResponseDto {
  @ApiProperty({ type: [PollMyParticipationItemDto] })
  items: PollMyParticipationItemDto[];
}
