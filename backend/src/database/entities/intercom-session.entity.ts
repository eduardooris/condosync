import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IntercomSessionStatus } from '../../common/enums';
import { Condominium } from './condominium.entity';
import { IntercomAccessToken } from './intercom-access-token.entity';
import { Resident } from './resident.entity';
import { Unit } from './unit.entity';
import { VisitorEntry } from './visitor-entry.entity';

@Entity('intercom_sessions')
export class IntercomSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'access_token_id', type: 'uuid' })
  accessTokenId: string;

  @ManyToOne(() => IntercomAccessToken, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'access_token_id' })
  accessToken: IntercomAccessToken;

  @Column({ name: 'visitor_name', type: 'varchar', length: 80 })
  visitorName: string;

  @Column({
    type: 'enum',
    enum: IntercomSessionStatus,
    default: IntercomSessionStatus.INITIATED,
  })
  status: IntercomSessionStatus;

  @Column({ name: 'answered_by_resident_id', type: 'uuid', nullable: true })
  answeredByResidentId: string | null;

  @ManyToOne(() => Resident, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'answered_by_resident_id' })
  answeredByResident: Resident | null;

  @Column({ name: 'visitor_entry_id', type: 'uuid', nullable: true })
  visitorEntryId: string | null;

  @ManyToOne(() => VisitorEntry, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'visitor_entry_id' })
  visitorEntry: VisitorEntry | null;

  @Column({ name: 'ring_expires_at', type: 'timestamptz', nullable: true })
  ringExpiresAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
