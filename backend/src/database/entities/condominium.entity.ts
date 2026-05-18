import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PixKeyType } from '../../common/enums';
import { UserCondominium } from './user-condominium.entity';
import { Unit } from './unit.entity';
import { Expense } from './expense.entity';
import { Poll } from './poll.entity';
import { BulletinPost } from './bulletin-post.entity';
import { Document } from './document.entity';

@Entity('condominiums')
export class Condominium {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  /**
   * Documento fiscal da administração. Pode ser:
   *   - CNPJ do condomínio (14 dígitos) — caso PJ formal
   *   - CPF do síndico (11 dígitos) — caso condomínio informal sem PJ
   *   - `null` — quando o síndico não quer informar ou ainda decidirá
   *
   * Antes era NOT NULL UNIQUE; passamos para nullable + unique parcial via
   * migration `1719500000000-CondominiumCnpjOptional` (mantém o UNIQUE
   * apenas para valores não-nulos, permitindo múltiplos condomínios sem
   * documento).
   */
  @Column({ type: 'varchar', nullable: true })
  cnpj: string | null;

  @Column({ type: 'jsonb', nullable: true })
  address: Record<string, unknown> | null;

  @Column({ name: 'photo_url', type: 'varchar', nullable: true })
  photoUrl: string | null;

  @Column({
    name: 'monthly_fee_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  monthlyFeeAmount: string;

  @Column({
    name: 'billing_generation_day',
    type: 'int',
    default: 1,
    comment: 'Day of month to generate charges (1-28)',
  })
  billingGenerationDay: number;

  @Column({
    name: 'billing_due_day',
    type: 'int',
    default: 10,
    comment: 'Due day of month (1-28)',
  })
  billingDueDay: number;

  @Column({
    name: 'pix_key_type',
    type: 'enum',
    enum: PixKeyType,
    nullable: true,
  })
  pixKeyType: PixKeyType | null;

  @Column({
    name: 'pix_key_value',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  pixKeyValue: string | null;

  @Column({
    name: 'admin_contact_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  adminContactPhone: string | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @OneToMany(() => UserCondominium, (uc) => uc.condominium)
  memberships: UserCondominium[];

  @OneToMany(() => Unit, (u) => u.condominium)
  units: Unit[];

  @OneToMany(() => Expense, (e) => e.condominium)
  expenses: Expense[];

  @OneToMany(() => Poll, (p) => p.condominium)
  polls: Poll[];

  @OneToMany(() => BulletinPost, (b) => b.condominium)
  bulletinPosts: BulletinPost[];

  @OneToMany(() => Document, (d) => d.condominium)
  documents: Document[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
