import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BulletinPriority } from '../../common/enums';
import { Condominium } from './condominium.entity';
import { User } from './user.entity';

@Entity('bulletin_posts')
export class BulletinPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, (c) => c.bulletinPosts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'enum',
    enum: BulletinPriority,
    default: BulletinPriority.INFO,
  })
  priority: BulletinPriority;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /**
   * Quando `true`, o post é fixado no topo da listagem (selo "fixado"
   * no PWA/app). Apenas ADMIN/SUB_ADMIN pode fixar.
   */
  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
