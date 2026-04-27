import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UnitStatus, UnitType } from '../../common/enums';
import { Condominium } from './condominium.entity';
import { Resident } from './resident.entity';
import { Charge } from './charge.entity';
import { PollVote } from './poll-vote.entity';
import { Occurrence } from './occurrence.entity';

@Entity('units')
@Unique(['condominiumId', 'block', 'number'])
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, (c) => c.units, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column()
  block: string;

  @Column()
  number: string;

  @Column({ type: 'enum', enum: UnitType, default: UnitType.APARTMENT })
  type: UnitType;

  @Column({ type: 'enum', enum: UnitStatus, default: UnitStatus.VACANT })
  status: UnitStatus;

  /**
   * Quando `true`, a unidade é permanentemente isenta de cobrança.
   * Utilizada por `ChargesService.generateMonth` para pular a unidade
   * na geração mensal automática (RN-03.2 / US-03).
   */
  @Column({ name: 'is_exempt', type: 'boolean', default: false })
  isExempt: boolean;

  @Column({ name: 'exemption_reason', type: 'text', nullable: true })
  exemptionReason: string | null;

  @OneToMany(() => Resident, (r) => r.unit)
  residents: Resident[];

  @OneToMany(() => Charge, (c) => c.unit)
  charges: Charge[];

  @OneToMany(() => PollVote, (pv) => pv.unit)
  pollVotes: PollVote[];

  @OneToMany(() => Occurrence, (o) => o.unit)
  occurrences: Occurrence[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
