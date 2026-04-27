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

export enum ParcelStatus {
  RECEIVED = 'RECEIVED',
  DELIVERED = 'DELIVERED',
}

@Entity('parcels')
export class Parcel {
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

  @Column({ name: 'resident_id', type: 'uuid', nullable: true })
  residentId: string | null;

  @ManyToOne(() => Resident, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident | null;

  @Column({ type: 'varchar' })
  carrier: string;

  @Column({ name: 'tracking_code', type: 'varchar', nullable: true })
  trackingCode: string | null;

  @Column({ type: 'enum', enum: ParcelStatus, default: ParcelStatus.RECEIVED })
  status: ParcelStatus;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
