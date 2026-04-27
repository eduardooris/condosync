import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Poll } from './poll.entity';
import { PollOption } from './poll-option.entity';
import { Unit } from './unit.entity';
import { Resident } from './resident.entity';

@Entity('poll_votes')
@Unique(['pollId', 'unitId'])
export class PollVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'poll_id', type: 'uuid' })
  pollId: string;

  @ManyToOne(() => Poll, (p) => p.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poll_id' })
  poll: Poll;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, (u) => u.pollVotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'option_id', type: 'uuid' })
  optionId: string;

  @ManyToOne(() => PollOption, (o) => o.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'option_id' })
  option: PollOption;

  @Column({ name: 'voted_by_resident_id', type: 'uuid' })
  votedByResidentId: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'voted_by_resident_id' })
  votedByResident: Resident;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
