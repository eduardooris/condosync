import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums';
import { Condominium } from './condominium.entity';
import { Resident } from './resident.entity';
import { Unit } from './unit.entity';
import { User } from './user.entity';

export enum InvitationType {
  /** Convite enviado para um e-mail específico (auto-aprovado no aceite). */
  EMAIL_DIRECT = 'EMAIL_DIRECT',
  /** Link genérico que pode ser aberto por qualquer pessoa (entra como PENDING). */
  GENERIC_LINK = 'GENERIC_LINK',
}

export enum InvitationStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXHAUSTED = 'EXHAUSTED',
}

/**
 * Convite para alguém entrar em um condomínio. O TOKEN BRUTO nunca fica
 * armazenado: salvamos apenas `tokenHash = sha256(tokenBruto)`. O token é
 * mostrado UMA vez para quem cria o convite (via `url`).
 */
@Entity('condominium_invitations')
@Index('idx_invitation_token_hash', ['tokenHash'])
export class CondominiumInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;

  @Column({ type: 'enum', enum: InvitationType })
  type: InvitationType;

  /** sha256 (hex) do token bruto. */
  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  /** Obrigatório para `EMAIL_DIRECT`, ignorado para `GENERIC_LINK`. */
  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId: string | null;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit | null;

  @Column({ name: 'resident_id', type: 'uuid', nullable: true })
  residentId: string | null;

  @ManyToOne(() => Resident, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'max_uses', type: 'int', default: 1 })
  maxUses: number;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.ACTIVE,
  })
  status: InvitationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
