import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Resident } from './resident.entity';
import { PaymentCustomer } from './payment-customer.entity';

/**
 * Mapeamento `Resident → PaymentCustomer` (N:1).
 *
 * Resolve em runtime "qual `Customer` Asaas usar pra cobrança da unidade X":
 *
 *   unit.residents[isFinancialResponsible=true]
 *     → resident.id
 *       → resident_payment_customer.payment_customer_id
 *         → payment_customers.asaas_customer_id
 *
 * Quando o responsável muda mantendo o CPF, a linha aponta pro mesmo
 * customer (reuso). Quando troca o CPF, a linha aponta pra outro
 * customer (criado ou reusado de outra unidade).
 */
@Entity('resident_payment_customers')
export class ResidentPaymentCustomer {
  @PrimaryColumn({ name: 'resident_id', type: 'uuid' })
  residentId: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @PrimaryColumn({ name: 'payment_customer_id', type: 'uuid' })
  paymentCustomerId: string;

  @ManyToOne(() => PaymentCustomer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_customer_id' })
  paymentCustomer: PaymentCustomer;

  @CreateDateColumn({ name: 'linked_at' })
  linkedAt: Date;
}
