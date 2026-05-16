import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IntercomSession } from './intercom-session.entity';

@Entity('intercom_session_events')
export class IntercomSessionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => IntercomSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: IntercomSession;

  @Column({ type: 'varchar', length: 64 })
  event: string;

  @Column({ name: 'payload_json', type: 'jsonb', nullable: true })
  payloadJson: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
