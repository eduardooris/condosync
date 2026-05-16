import { Poll } from '../../database/entities/poll.entity';
import { PollVote } from '../../database/entities/poll-vote.entity';
import { PollStatus } from '../../common/enums';
import { PollResponseDto } from './dto/poll-response.dto';

/**
 * Constrói a resposta HTTP de uma enquete enriquecida com:
 *  - `options[].votes` — somente quando a enquete está encerrada OU o
 *    usuário já votou (após o voto, faz sentido devolver a contagem
 *    para a UI exibir o resultado);
 *  - `totalVotes` — total de votos efetivos;
 *  - `voted` — opção em que a unidade do usuário votou (ou `null`).
 *
 * Para enquetes em aberto onde o usuário ainda não votou, retorna
 * `votes: 0` em cada opção para respeitar RN-04.3 (não vazar resultado
 * parcial entre eleitores) — o `totalVotes` continua exposto porque é
 * informação de engajamento, não de tendência.
 */
export const toPollResponse = (
  poll: Poll,
  votes: PollVote[],
  voterUnitId: string | null,
): PollResponseDto => {
  const totalVotes = votes.length;
  const userVote = voterUnitId
    ? votes.find((v) => v.unitId === voterUnitId)
    : undefined;
  const hasVoted = !!userVote;
  const expose = hasVoted || poll.status === PollStatus.CLOSED;

  const countsByOption = new Map<string, number>();
  if (expose) {
    for (const v of votes) {
      countsByOption.set(v.optionId, (countsByOption.get(v.optionId) ?? 0) + 1);
    }
  }

  const options = (poll.options ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({
      id: o.id,
      pollId: o.pollId,
      label: o.label,
      sortOrder: o.sortOrder,
      votes: expose ? (countsByOption.get(o.id) ?? 0) : 0,
    }));

  return {
    id: poll.id,
    condominiumId: poll.condominiumId,
    title: poll.title,
    description: poll.description,
    quorumPercent: poll.quorumPercent,
    closesAt: poll.closesAt,
    closedAt: poll.closedAt,
    isAnonymous: poll.isAnonymous,
    status: poll.status,
    createdByUserId: poll.createdByUserId,
    options,
    totalVotes,
    voted: userVote?.optionId ?? null,
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
  };
};
