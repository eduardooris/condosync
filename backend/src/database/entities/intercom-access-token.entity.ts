import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Condominium } from './condominium.entity';

@Entity('intercom_access_tokens')
export class IntercomAccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  /** Valor bruto do token (só leitura admin) para exibir QR/link novamente. */
  @Column({ name: 'token_secret', type: 'varchar', length: 64, nullable: true })
  tokenSecret: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  label: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
