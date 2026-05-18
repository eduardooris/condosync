import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentAccount } from './payment-account.entity';

/**
 * Auditoria + idempotência de eventos webhook recebidos do Asaas.
 *
 * Idempotência via `dedup_key` UNIQUE: `sha256(event + payment.id + payment.status + dateCreated)`.
 * Asaas retenta em 5xx — gravar com `orIgnore()` no INSERT impede processamento
 * duplicado mesmo que a Asaas mande o mesmo evento N vezes.
 */
@Entity('payment_webhook_events')
@Index(['asaasPaymentId', 'event'])
@Index(['receivedAt'])
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_account_id', type: 'uuid' })
  paymentAccountId: string;

  @ManyToOne(() => PaymentAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_account_id' })
  paymentAccount: PaymentAccount;

  @Column({ type: 'varchar' })
  event: string;

  @Column({ name: 'asaas_payment_id', type: 'varchar', nullable: true })
  asaasPaymentId: string | null;

  @Column({ name: 'dedup_key', type: 'varchar', unique: true })
  dedupKey: string;

  @Column({ name: 'payload_raw', type: 'jsonb' })
  payloadRaw: Record<string, unknown>;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'processing_error', type: 'text', nullable: true })
  processingError: string | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
