import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Condominium } from './condominium.entity';
import { Unit } from './unit.entity';
import { Resident } from './resident.entity';

export enum VisitorEntryStatus {
  EXPECTED = 'EXPECTED',
  ARRIVED = 'ARRIVED',
  CANCELED = 'CANCELED',
}

@Entity('visitor_entries')
export class VisitorEntry {
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

  @Column({ name: 'resident_id', type: 'uuid' })
  residentId: string;

  @ManyToOne(() => Resident, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'visitor_name', type: 'varchar' })
  visitorName: string;

  @Column({ name: 'visitor_document', type: 'varchar', nullable: true })
  visitorDocument: string | null;

  @Column({ name: 'expected_at', type: 'timestamptz' })
  expectedAt: Date;

  @Column({
    type: 'enum',
    enum: VisitorEntryStatus,
    default: VisitorEntryStatus.EXPECTED,
  })
  status: VisitorEntryStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
