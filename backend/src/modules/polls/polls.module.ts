import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Poll } from '../../database/entities/poll.entity';
import { PollOption } from '../../database/entities/poll-option.entity';
import { PollVote } from '../../database/entities/poll-vote.entity';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { PollsController, PollVoteController } from './polls.controller';
import { PollsService } from './polls.service';
import { PollsRepository } from './polls.repository';
import { PollsAutoCloseProcessor } from './processors/polls-autoclose.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Poll,
      PollOption,
      PollVote,
      Resident,
      Unit,
      UserCondominium,
    ]),
  ],
  controllers: [PollsController, PollVoteController],
  providers: [PollsRepository, PollsService, PollsAutoCloseProcessor],
})
export class PollsModule {}
