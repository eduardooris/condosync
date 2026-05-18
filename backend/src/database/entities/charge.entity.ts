import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChargeStatus } from '../../common/enums';
import { Unit } from './unit.entity';

@Entity('charges')
export class Charge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, (u) => u.charges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ name: 'billing_month', type: 'varchar', length: 7 })
  billingMonth: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ChargeStatus, default: ChargeStatus.PENDING })
  status: ChargeStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /**
   * Método de pagamento usado, uniforme entre Asaas e baixa manual.
   * Asaas: PIX | BOLETO | CREDIT_CARD | DEBIT_CARD
   * Manual: MANUAL_CASH | MANUAL_TRANSFER | MANUAL_OTHER
   */
  @Column({ name: 'paid_method', type: 'varchar', length: 32, nullable: true })
  paidMethod: string | null;

  /** Observação livre quando admin dá baixa manual (ex.: "via DOC banco X"). */
  @Column({ name: 'paid_note', type: 'text', nullable: true })
  paidNote: string | null;

  @Column({ name: 'exempt_reason', type: 'text', nullable: true })
  exemptReason: string | null;

  @Column({ name: 'canceled_at', type: 'timestamptz', nullable: true })
  canceledAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  // ── Asaas (gateway de pagamentos) ───────────────────────────────────────
  // Preenchidos quando a cobrança é emitida via subconta Asaas
  // (ver `PaymentsModule`). Cobrança gerada antes do go-live ou em
  // condomínio sem subconta ativa fica com tudo `null` — Pix manual.

  /** ID Asaas (`pay_xxx`). Unique para impedir duplicação por retry. */
  @Column({ name: 'asaas_payment_id', type: 'varchar', nullable: true, unique: true })
  asaasPaymentId: string | null;

  /** URL pública do Asaas Checkout (pagador escolhe Pix/boleto/cartão). */
  @Column({ name: 'asaas_invoice_url', type: 'varchar', length: 512, nullable: true })
  asaasInvoiceUrl: string | null;

  /** Pix copia-cola (BR Code). Cacheado para evitar GET extra a cada visualização. */
  @Column({ name: 'asaas_pix_payload', type: 'text', nullable: true })
  asaasPixPayload: string | null;

  /** QR Code em base64 (PNG). Vazio até primeira leitura. */
  @Column({ name: 'asaas_pix_qr_base64', type: 'text', nullable: true })
  asaasPixQrBase64: string | null;

  /** PDF do boleto (preenchido após `POST /payments`). */
  @Column({ name: 'asaas_bank_slip_url', type: 'varchar', length: 512, nullable: true })
  asaasBankSlipUrl: string | null;

  /** Recibo oficial Asaas (URL público) — preenchido pelo webhook PAYMENT_RECEIVED. */
  @Column({
    name: 'asaas_transaction_receipt_url',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  asaasTransactionReceiptUrl: string | null;

  /**
   * Método usado no pagamento (preenchido por webhook PAYMENT_RECEIVED).
   * Varchar (não enum) porque Asaas pode mandar valores novos sem aviso —
   * tipicamente PIX/BOLETO/CREDIT_CARD/DEBIT_CARD; ignoramos 'UNDEFINED'.
   */
  @Column({ name: 'asaas_paid_via', type: 'varchar', length: 32, nullable: true })
  asaasPaidVia: string | null;

  /** Último evento processado (auditoria + dedup). */
  @Column({ name: 'asaas_last_event', type: 'varchar', nullable: true })
  asaasLastEvent: string | null;

  @Column({ name: 'asaas_synced_at', type: 'timestamptz', nullable: true })
  asaasSyncedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
