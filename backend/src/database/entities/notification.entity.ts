import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  CHARGE_CREATED = 'CHARGE_CREATED',
  CHARGE_OVERDUE = 'CHARGE_OVERDUE',
  CHARGE_PAID = 'CHARGE_PAID',
  POLL_CREATED = 'POLL_CREATED',
  POLL_CLOSED = 'POLL_CLOSED',
  OCCURRENCE_STATUS = 'OCCURRENCE_STATUS',
  BULLETIN_NEW = 'BULLETIN_NEW',
  DOCUMENT_NEW = 'DOCUMENT_NEW',
  BALANCE_NEGATIVE = 'BALANCE_NEGATIVE',
  MEMBER_PENDING_APPROVAL = 'MEMBER_PENDING_APPROVAL',
}

/**
 * Notificação in-app entregue ao usuário. Em paralelo, o `WhatsApp`
 * adapter pode mandar a mesma mensagem por fora — esta entidade é a
 * fonte de verdade para o badge "novidades" do PWA.
 */
@Entity('notifications')
@Index(['userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'condominium_id', type: 'uuid', nullable: true })
  condominiumId: string | null;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Payload livre serializado (ID da cobrança, da enquete etc.). */
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  /**
   * URL relativa para navegação contextual no app/PWA (ex.:
   * `/charges/:id`, `/polls/:id`). Derivado de `type` + `payload`
   * no momento da criação. Permite ao cliente abrir a tela certa ao
   * tocar/clicar na notificação.
   */
  @Column({ name: 'deeplink', type: 'varchar', length: 255, nullable: true })
  deeplink: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
