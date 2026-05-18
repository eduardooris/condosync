import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Condominium } from './condominium.entity';
import { PaymentAccount } from './payment-account.entity';

/**
 * Customer Asaas reusável por subconta — **1 por CPF por subconta**.
 *
 * Importante: NÃO é 1 por `Resident`. Mesmo CPF em N unidades da mesma
 * subconta = 1 só customer (Payment aponta pra ele via `customer` field).
 *
 * Ver `docs/06_pagamentos_asaas.md §2.3.1` para a explicação completa.
 */
@Entity('payment_customers')
@Unique('UQ_payment_customers_account_cpf', ['paymentAccountId', 'cpf'])
@Index(['asaasCustomerId'])
export class PaymentCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_account_id', type: 'uuid' })
  paymentAccountId: string;

  @ManyToOne(() => PaymentAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_account_id' })
  paymentAccount: PaymentAccount;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @ManyToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  /** Só dígitos. Espelho do `residents.cpf`. */
  @Column({ type: 'varchar', length: 11 })
  cpf: string;

  @Column({ name: 'legal_name', type: 'varchar' })
  legalName: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'phone_whatsapp', type: 'varchar', nullable: true })
  phoneWhatsapp: string | null;

  @Column({ name: 'asaas_customer_id', type: 'varchar' })
  asaasCustomerId: string;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
