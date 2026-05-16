import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { DevicePlatform } from '../../common/enums';
import { Resident } from './resident.entity';
import { User } from './user.entity';

@Entity('device_registrations')
@Unique('UQ_device_registrations_user_device', ['userId', 'deviceId'])
export class DeviceRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'resident_id', type: 'uuid', nullable: true })
  residentId: string | null;

  @ManyToOne(() => Resident, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident | null;

  @Column({ name: 'device_id', type: 'varchar', length: 128 })
  deviceId: string;

  @Column({ type: 'enum', enum: DevicePlatform })
  platform: DevicePlatform;

  @Column({ name: 'push_token', type: 'varchar', nullable: true })
  pushToken: string | null;

  @Column({ name: 'voip_token', type: 'varchar', nullable: true })
  voipToken: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
