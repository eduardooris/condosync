import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { PollStatus } from '../../common/enums';
import { Poll } from '../../database/entities/poll.entity';
import { PollOption } from '../../database/entities/poll-option.entity';
import { PollVote } from '../../database/entities/poll-vote.entity';

@Injectable()
export class PollsRepository {
  constructor(
    @InjectRepository(Poll)
    private readonly pollRepo: Repository<Poll>,
    @InjectRepository(PollOption)
    private readonly optionRepo: Repository<PollOption>,
    @InjectRepository(PollVote)
    private readonly voteRepo: Repository<PollVote>,
  ) {}

  findByCondo(condominiumId: string) {
    return this.pollRepo.find({
      where: { condominiumId },
      relations: ['options'],
      order: { createdAt: 'DESC' },
    });
  }

  findById(condominiumId: string, id: string) {
    return this.pollRepo.findOne({
      where: { id, condominiumId },
      relations: ['options'],
    });
  }

  findByIdWithVotes(condominiumId: string, id: string) {
    return this.pollRepo.findOne({
      where: { id, condominiumId },
      relations: ['options', 'votes'],
    });
  }

  findByIdOnly(id: string) {
    return this.pollRepo.findOne({ where: { id } });
  }

  findByIdWithOptions(id: string) {
    return this.pollRepo.findOne({ where: { id }, relations: ['options'] });
  }

  findVoteByPollAndUnit(pollId: string, unitId: string) {
    return this.voteRepo.findOne({ where: { pollId, unitId } });
  }

  savePoll(entity: Poll) {
    return this.pollRepo.save(entity);
  }

  createPoll(data: Partial<Poll>) {
    return this.pollRepo.create(data as Poll);
  }

  saveOptions(entities: PollOption[]) {
    return this.optionRepo.save(entities);
  }

  createOption(data: Partial<PollOption>) {
    return this.optionRepo.create(data as PollOption);
  }

  saveVote(entity: PollVote) {
    return this.voteRepo.save(entity);
  }

  createVote(data: Partial<PollVote>) {
    return this.voteRepo.create(data as PollVote);
  }

  /** Enquetes abertas com `closesAt` no passado — usadas pelo
   *  scheduler para fechamento automático. */
  findExpiredOpen() {
    return this.pollRepo.find({
      where: {
        status: PollStatus.OPEN,
        closesAt: LessThanOrEqual(new Date()),
      },
      relations: ['options', 'votes'],
    });
  }
}
