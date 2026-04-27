import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PollStatus } from '../../common/enums';
import { Condominium } from './condominium.entity';
import { User } from './user.entity';
import { PollOption } from './poll-option.entity';
import { PollVote } from './poll-vote.entity';

@Entity('polls')
export class Poll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, (c) => c.polls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'quorum_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  quorumPercent: string;

  @Column({ name: 'closes_at', type: 'timestamptz' })
  closesAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'is_anonymous', default: true })
  isAnonymous: boolean;

  @Column({ type: 'enum', enum: PollStatus, default: PollStatus.OPEN })
  status: PollStatus;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;

  @OneToMany(() => PollOption, (o) => o.poll, { cascade: true })
  options: PollOption[];

  @OneToMany(() => PollVote, (v) => v.poll)
  votes: PollVote[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
