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
import { User } from './user.entity';
import { Unit } from './unit.entity';

@Entity('residents')
@Unique('UQ_residents_unit_cpf', ['unitId', 'cpf'])
export class Resident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, (u) => u.residents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (u) => u.residents, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 14 })
  cpf: string;

  @Column({ name: 'phone_whatsapp', type: 'varchar' })
  phoneWhatsapp: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'is_financial_responsible', default: false })
  isFinancialResponsible: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
