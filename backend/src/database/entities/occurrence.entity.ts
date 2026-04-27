import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OccurrenceStatus } from '../../common/enums';
import { Condominium } from './condominium.entity';
import { Unit } from './unit.entity';
import { Resident } from './resident.entity';

@Entity('occurrences')
export class Occurrence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, (u) => u.occurrences, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'author_resident_id', type: 'uuid' })
  authorResidentId: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_resident_id' })
  authorResident: Resident;

  @Column()
  title: string;

  @Column()
  category: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: OccurrenceStatus,
    default: OccurrenceStatus.OPEN,
  })
  status: OccurrenceStatus;

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

  @Column({ name: 'attachment_storage_key', type: 'varchar', nullable: true })
  attachmentStorageKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
