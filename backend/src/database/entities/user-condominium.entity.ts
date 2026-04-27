import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserRole } from '../../common/enums';
import { User } from './user.entity';
import { Condominium } from './condominium.entity';
import { Unit } from './unit.entity';

export enum MembershipStatus {
  /** Aguardando aprovação por ADMIN/SUB_ADMIN do condomínio. */
  PENDING = 'PENDING',
  /** Membro ativo (default). */
  APPROVED = 'APPROVED',
}

@Entity('user_condominiums')
@Unique(['userId', 'condominiumId'])
export class UserCondominium {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, (c) => c.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.RESIDENT })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.APPROVED,
  })
  status: MembershipStatus;

  /**
   * Unidade do morador, quando aplicável (RESIDENT/RESPONSIBLE).
   * ADMIN/SUB_ADMIN normalmente ficam sem unidade.
   */
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId: string | null;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
