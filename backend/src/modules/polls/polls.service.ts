import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { Poll } from '../../database/entities/poll.entity';
import { PollVote } from '../../database/entities/poll-vote.entity';
import { PollStatus, UnitStatus } from '../../common/enums';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollsRepository } from './polls.repository';
import {
  PollResponseDto,
  PollResultsResponseDto,
  PollVoteResponseDto,
} from './dto/poll-response.dto';
import { toPollResponse } from './poll.mapper';
import { PollMyParticipationResponseDto } from './dto/poll-my-participation.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../database/entities/notification.entity';
import { QUEUE_WHATSAPP_SEND } from '../../queues/queue-names';
import { normalizeBrazilWhatsapp } from '../../common/utils/br-documents';

@Injectable()
export class PollsService {
  constructor(
    private readonly pollsRepo: PollsRepository,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(UserCondominium)
    private readonly ucRepo: Repository<UserCondominium>,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUE_WHATSAPP_SEND)
    private readonly whatsappQueue: Queue,
  ) {}

  async create(
    condominiumId: string,
    userId: string,
    dto: CreatePollDto,
  ): Promise<Poll> {
    const poll = this.pollsRepo.createPoll({
      condominiumId,
      title: dto.title,
      description: dto.description ?? null,
      quorumPercent: String(dto.quorumPercent),
      closesAt: new Date(dto.closesAt),
      isAnonymous: dto.isAnonymous ?? true,
      status: PollStatus.OPEN,
      createdByUserId: userId,
    });
    await this.pollsRepo.savePoll(poll);
    const options = dto.options.map((o, i) =>
      this.pollsRepo.createOption({
        pollId: poll.id,
        label: o.label,
        sortOrder: o.sortOrder ?? i,
      }),
    );
    await this.pollsRepo.saveOptions(options);
    const created = (await this.pollsRepo.findByIdWithOptions(poll.id)) as Poll;
    await this.notifyPollCreated(created);
    return created;
  }

  private async notifyPollCreated(poll: Poll): Promise<void> {
    const memberships = await this.ucRepo.find({
      where: { condominiumId: poll.condominiumId },
      select: ['userId'],
    });
    if (memberships.length === 0) return;
    await this.notifications.createMany(
      memberships.map((m) => ({
        userId: m.userId,
        condominiumId: poll.condominiumId,
        type: NotificationType.POLL_CREATED,
        title: `Nova enquete: ${poll.title}`,
        body:
          poll.description?.slice(0, 200) ??
          'Uma nova enquete foi aberta no seu condomínio.',
        payload: {
          pollId: poll.id,
          closesAt: poll.closesAt.toISOString(),
        },
      })),
    );
    await this.enqueuePollCreatedWhatsapp(poll);
  }

  /**
   * Um job por número (deduplicado) — moradores da mesma unidade ou
   * cadastros duplicados não recebem a mesma mensagem duas vezes.
   */
  private async enqueuePollCreatedWhatsapp(poll: Poll): Promise<void> {
    const residents = await this.residentRepo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('u.condominium_id = :condominiumId', {
        condominiumId: poll.condominiumId,
      })
      .andWhere('r.phone_whatsapp IS NOT NULL')
      .getMany();
    const seenPhones = new Set<string>();
    for (const row of residents) {
      const phone = row.phoneWhatsapp?.trim();
      if (!phone) {
        continue;
      }
      const norm = normalizeBrazilWhatsapp(phone);
      if (!norm || seenPhones.has(norm)) {
        continue;
      }
      seenPhones.add(norm);
      await this.whatsappQueue.add(
        'poll-created',
        { pollId: poll.id, phone },
        { jobId: `poll:${poll.id}:wa:${norm}` },
      );
    }
  }

  async list(
    condominiumId: string,
    userId: string,
  ): Promise<PollResponseDto[]> {
    const polls = await this.pollsRepo.findByCondo(condominiumId);
    if (polls.length === 0) return [];
    const voterUnitId = await this.findVoterUnitId(condominiumId, userId);
    // Carrega votos por enquete (uma query por enquete já que findByCondo não
    // popula relação `votes`); o número de enquetes em aberto por condomínio
    // é tipicamente baixo (<10), portanto aceitável.
    return Promise.all(
      polls.map(async (p) => {
        const withVotes = await this.pollsRepo.findByIdWithVotes(
          condominiumId,
          p.id,
        );
        return toPollResponse(
          withVotes ?? p,
          withVotes?.votes ?? [],
          voterUnitId,
        );
      }),
    );
  }

  /** Resolve a unitId em que o usuário é responsável financeiro
   * (única que tem direito a voto, RN-04.2). */
  private async findVoterUnitId(
    condominiumId: string,
    userId: string,
  ): Promise<string | null> {
    const resident = await this.residentRepo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.is_financial_responsible = true')
      .andWhere('u.condominium_id = :condominiumId', { condominiumId })
      .getOne();
    return resident?.unitId ?? null;
  }

  /**
   * Para cada enquete do condomínio, indica se o usuário pode votar
   * (responsável financeiro) e, sem revelar totais, se a unidade dele já
   * votou e em qual opção.
   */
  async myParticipation(
    condominiumId: string,
    userId: string,
  ): Promise<PollMyParticipationResponseDto> {
    const polls = await this.pollsRepo.findByCondo(condominiumId);
    const resident = await this.residentRepo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.is_financial_responsible = true')
      .andWhere('u.condominium_id = :condominiumId', { condominiumId })
      .getOne();
    const items = await Promise.all(
      polls.map(async (poll) => {
        if (!resident) {
          return {
            pollId: poll.id,
            canVote: false,
            hasVoted: false,
            selectedOptionId: null,
          };
        }
        const existing = await this.pollsRepo.findVoteByPollAndUnit(
          poll.id,
          resident.unitId,
        );
        return {
          pollId: poll.id,
          canVote: true,
          hasVoted: Boolean(existing),
          selectedOptionId: existing?.optionId ?? null,
        };
      }),
    );
    return { items };
  }

  async getOne(
    condominiumId: string,
    pollId: string,
    userId: string,
  ): Promise<PollResponseDto> {
    const p = await this.pollsRepo.findByIdWithVotes(condominiumId, pollId);
    if (!p) {
      throw new NotFoundException('Enquete não encontrada.');
    }
    const voterUnitId = await this.findVoterUnitId(condominiumId, userId);
    return toPollResponse(p, p.votes ?? [], voterUnitId);
  }

  /**
   * Remove `votes` quando a enquete ainda está aberta (RN-04.3 — não
   * deixar resultado parcial vazar) e simplifica `options` para o cliente.
   */
  private sanitizePollForViewer(p: Poll): Partial<Poll> {
    if (p.status === PollStatus.CLOSED) {
      return p;
    }
    const { votes, ...rest } = p;
    void votes;
    const options = (p.options ?? []).map((o) => ({
      id: o.id,
      pollId: o.pollId,
      label: o.label,
      sortOrder: o.sortOrder,
    }));
    return { ...rest, options } as Partial<Poll>;
  }

  async voteByPollId(
    pollId: string,
    userId: string,
    optionId: string,
  ): Promise<PollVoteResponseDto> {
    const poll = await this.pollsRepo.findByIdOnly(pollId);
    if (!poll) {
      throw new NotFoundException('Enquete não encontrada.');
    }
    const member = await this.ucRepo.findOne({
      where: { userId, condominiumId: poll.condominiumId },
    });
    if (!member) {
      throw new ForbiddenException(
        'Você não pertence ao condomínio desta enquete.',
      );
    }
    return this.vote(poll.condominiumId, pollId, userId, optionId);
  }

  async vote(
    condominiumId: string,
    pollId: string,
    userId: string,
    optionId: string,
  ): Promise<PollVoteResponseDto> {
    const poll = await this.pollsRepo.findByIdWithOptions(pollId);
    if (
      !poll ||
      poll.condominiumId !== condominiumId ||
      poll.status !== PollStatus.OPEN
    ) {
      throw new BadRequestException('Enquete não está aberta para votação.');
    }
    if (new Date() > poll.closesAt) {
      throw new BadRequestException(
        'Prazo de votação encerrado para esta enquete.',
      );
    }
    const validOption = poll.options?.some((o) => o.id === optionId);
    if (!validOption) {
      throw new BadRequestException(
        'Opção informada não pertence a esta enquete.',
      );
    }
    const resident = await this.residentRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.unit', 'u')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.is_financial_responsible = true')
      .andWhere('u.condominium_id = :condominiumId', { condominiumId })
      .getOne();
    if (!resident) {
      throw new ForbiddenException(
        'Apenas o responsável financeiro de uma unidade pode votar.',
      );
    }
    const existing = await this.pollsRepo.findVoteByPollAndUnit(
      pollId,
      resident.unitId,
    );
    if (existing) {
      throw new BadRequestException(
        'Esta unidade já votou na enquete (1 voto por unidade — RN-04.1).',
      );
    }
    const vote = this.pollsRepo.createVote({
      pollId,
      unitId: resident.unitId,
      optionId,
      votedByResidentId: resident.id,
    });
    const saved = await this.pollsRepo.saveVote(vote);
    return this.sanitizeVote(saved, poll);
  }

  /**
   * Aplica RN-04.1 — em enquetes anônimas, o identificador do votante
   * (`votedByResidentId`) NUNCA é exposto pela API. A coluna continua
   * persistida porque é necessária para a constraint UNIQUE
   * (poll_id, unit_id) e para auditoria interna.
   */
  private sanitizeVote(vote: PollVote, poll: Poll): PollVoteResponseDto {
    return {
      id: vote.id,
      pollId: vote.pollId,
      unitId: poll.isAnonymous ? null : vote.unitId,
      optionId: vote.optionId,
      votedByResidentId: poll.isAnonymous ? null : vote.votedByResidentId,
      createdAt: vote.createdAt,
    };
  }

  async close(condominiumId: string, pollId: string): Promise<Poll> {
    const poll = await this.pollsRepo.findById(condominiumId, pollId);
    if (!poll) {
      throw new NotFoundException('Enquete não encontrada.');
    }
    if (poll.status === PollStatus.CLOSED) {
      throw new BadRequestException('Enquete já encerrada.');
    }
    poll.status = PollStatus.CLOSED;
    poll.closedAt = new Date();
    const saved = await this.pollsRepo.savePoll(poll);
    await this.notifyPollClosed(saved);
    return saved;
  }

  /**
   * Fechamento automático (job diário). Encerra enquetes cujo
   * `closesAt` já passou. Retorna a quantidade de enquetes fechadas.
   */
  async autoCloseExpired(): Promise<{ closed: number }> {
    const expired = await this.pollsRepo.findExpiredOpen();
    let closed = 0;
    for (const poll of expired) {
      poll.status = PollStatus.CLOSED;
      poll.closedAt = new Date();
      await this.pollsRepo.savePoll(poll);
      await this.notifyPollClosed(poll);
      closed++;
    }
    return { closed };
  }

  private async notifyPollClosed(poll: Poll): Promise<void> {
    const memberships = await this.ucRepo.find({
      where: { condominiumId: poll.condominiumId },
      select: ['userId'],
    });
    if (memberships.length === 0) return;
    await this.notifications.createMany(
      memberships.map((m) => ({
        userId: m.userId,
        condominiumId: poll.condominiumId,
        type: NotificationType.POLL_CLOSED,
        title: `Enquete encerrada: ${poll.title}`,
        body: 'Os resultados da enquete já estão disponíveis.',
        payload: { pollId: poll.id },
      })),
    );
  }

  async results(
    condominiumId: string,
    pollId: string,
  ): Promise<PollResultsResponseDto> {
    const poll = await this.pollsRepo.findByIdWithVotes(condominiumId, pollId);
    if (!poll) {
      throw new NotFoundException('Enquete não encontrada.');
    }
    if (poll.status !== PollStatus.CLOSED) {
      throw new ForbiddenException(
        'Resultados disponíveis apenas após o encerramento da enquete (RN-04.3).',
      );
    }
    const totalUnits = await this.unitRepo.count({
      where: { condominiumId, status: UnitStatus.OCCUPIED },
    });
    const counts: Record<string, number> = {};
    for (const o of poll.options ?? []) {
      counts[o.id] = 0;
    }
    for (const v of poll.votes ?? []) {
      counts[v.optionId] = (counts[v.optionId] ?? 0) + 1;
    }
    const totalVotes = poll.votes?.length ?? 0;
    const quorum = Number(poll.quorumPercent ?? '0');
    const reachedPercent = totalUnits > 0 ? (totalVotes / totalUnits) * 100 : 0;
    return {
      pollId: poll.id,
      title: poll.title,
      totalVotes,
      totalOccupiedUnits: totalUnits,
      quorumPercent: poll.quorumPercent,
      quorumReached: reachedPercent >= quorum,
      counts,
    };
  }
}
