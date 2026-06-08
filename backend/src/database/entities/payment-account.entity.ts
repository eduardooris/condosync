import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Condominium } from './condominium.entity';

/**
 * Tipo de titular da subconta — define quais campos KYC são obrigatórios e
 * quais documentos a Asaas pedirá (RG/CNH para PF/MEI, contrato social para PJ).
 */
export enum PaymentAccountHolderType {
  PF = 'PF',
  MEI = 'MEI',
  PJ = 'PJ',
}

/**
 * Status local da subconta — espelha a aprovação da Asaas mas com nuances
 * próprias do nosso fluxo (`DRAFT` antes de chamar `POST /accounts`).
 *
 * Transições:
 *
 *   DRAFT ──► PENDING_DOCS ──► PENDING_REVIEW ──► ACTIVE
 *                  │                  │
 *                  ▼                  ▼
 *               REJECTED          BLOCKED
 */
export enum PaymentAccountStatus {
  DRAFT = 'DRAFT',
  PENDING_DOCS = 'PENDING_DOCS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
  REJECTED = 'REJECTED',
}

/**
 * Aprovações individuais reportadas pela Asaas (comercial / bancária / docs).
 * Mantemos uma cópia local para evitar chamada extra ao painel.
 */
export enum PaymentAccountApprovalStatus {
  PENDING = 'PENDING',
  AWAITING_DOCS = 'AWAITING_DOCS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Subconta Asaas vinculada 1:1 a um condomínio. Armazena os dados do titular
 * (síndico — PF/MEI/PJ) e os identificadores que a Asaas devolveu na criação.
 *
 * A `asaas_api_key` é criptografada em repouso via `PaymentEncryptionService`.
 * Nunca é exposta em logs nem em responses HTTP da nossa API.
 */
@Entity('payment_accounts')
@Index(['condominiumId'], { unique: true })
@Index(['asaasAccountId'])
@Index(['status'])
export class PaymentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'condominium_id', type: 'uuid' })
  condominiumId: string;

  @OneToOne(() => Condominium, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'condominium_id' })
  condominium: Condominium;

  // ── Titular (síndico) ─────────────────────────────────────────────────────

  @Column({
    name: 'holder_type',
    type: 'enum',
    enum: PaymentAccountHolderType,
  })
  holderType: PaymentAccountHolderType;

  /** Só dígitos: 11 (CPF) ou 14 (CNPJ). */
  @Column({ name: 'holder_cpf_cnpj', type: 'varchar', length: 14 })
  holderCpfCnpj: string;

  @Column({ name: 'holder_legal_name', type: 'varchar' })
  holderLegalName: string;

  /** Obrigatório para PF (Asaas exige `birthDate`). NULL para PJ. */
  @Column({ name: 'holder_birth_date', type: 'date', nullable: true })
  holderBirthDate: string | null;

  @Column({ name: 'holder_email', type: 'varchar' })
  holderEmail: string;

  /** Formato Asaas: dígitos sem máscara, com DDI (`55` + DDD + número). */
  @Column({ name: 'holder_mobile_phone', type: 'varchar', length: 15 })
  holderMobilePhone: string;

  /** Renda mensal (PF) ou faturamento (PJ). Asaas exige desde 30/mai/2024. */
  @Column({
    name: 'holder_income_value',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  holderIncomeValue: string;

  /**
   * Endereço completo do titular. Armazenado como JSONB para flexibilidade
   * (ex.: PJ pode ter complemento estruturado, PF não). Shape esperado:
   * `{ street, number, complement?, province, postalCode, city, state }`.
   */
  @Column({ name: 'holder_address', type: 'jsonb' })
  holderAddress: Record<string, string | null>;

  // ── Asaas (devolvidos pela API ao criar) ──────────────────────────────────

  @Column({ name: 'asaas_account_id', type: 'varchar' })
  asaasAccountId: string;

  /** walletId — usado em split para enviar valores a essa subconta. */
  @Column({ name: 'asaas_wallet_id', type: 'varchar' })
  asaasWalletId: string;

  /**
   * apiKey criptografada (AES-256-GCM). Veja
   * `PaymentEncryptionService` para o formato do envelope.
   * **Nunca selecionar em queries que retornam para a UI.**
   */
  @Column({ name: 'asaas_api_key', type: 'bytea', select: false })
  asaasApiKey: Buffer;

  /**
   * Segredo aleatório (32 bytes hex). Configurado no webhook da Asaas como
   * `authToken` — vem no header `asaas-access-token` em cada callback.
   * Usamos para resolver `payment_account_id` no `AsaasWebhookGuard`.
   */
  @Column({ name: 'asaas_webhook_token', type: 'varchar', select: false })
  asaasWebhookToken: string;

  // ── Status ────────────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: PaymentAccountStatus,
    default: PaymentAccountStatus.DRAFT,
  })
  status: PaymentAccountStatus;

  @Column({
    name: 'commercial_info_status',
    type: 'enum',
    enum: PaymentAccountApprovalStatus,
    nullable: true,
  })
  commercialInfoStatus: PaymentAccountApprovalStatus | null;

  @Column({
    name: 'bank_account_info_status',
    type: 'enum',
    enum: PaymentAccountApprovalStatus,
    nullable: true,
  })
  bankAccountInfoStatus: PaymentAccountApprovalStatus | null;

  @Column({
    name: 'documentation_status',
    type: 'enum',
    enum: PaymentAccountApprovalStatus,
    nullable: true,
  })
  documentationStatus: PaymentAccountApprovalStatus | null;

  /** Motivo (se houver) quando `status = REJECTED` ou `BLOCKED`. */
  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({
    name: 'onboarding_url',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  onboardingUrl: string | null;

  @Column({ name: 'last_status_check_at', type: 'timestamptz', nullable: true })
  lastStatusCheckAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
