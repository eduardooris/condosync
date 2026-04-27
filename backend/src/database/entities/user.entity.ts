import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserCondominium } from './user-condominium.entity';
import { Resident } from './resident.entity';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'full_name', type: 'varchar', nullable: true })
  fullName: string | null;

  /**
   * WhatsApp da conta (síndico / usuário sem morador): usado no fluxo
   * “esqueci minha senha” quando não houver `Resident` com número.
   */
  @Column({
    name: 'phone_whatsapp',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  phoneWhatsapp: string | null;

  @OneToMany(() => UserCondominium, (uc) => uc.user)
  memberships: UserCondominium[];

  @OneToMany(() => Resident, (r) => r.user)
  residents: Resident[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
