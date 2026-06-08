import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { ChargesService } from './charges.service';
import { ChargesRepository } from './charges.repository';
import { Unit } from '../../database/entities/unit.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { Resident } from '../../database/entities/resident.entity';
import { ForbiddenException } from '@nestjs/common';
import { getLoggerToken } from 'nestjs-pino';
import { ChargeStatus } from '../../common/enums';
import { TenantMembershipService } from '../../common/services/tenant-membership.service';
import { QUEUE_WHATSAPP_SEND } from '../../queues/queue-names';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentAccountsService } from '../payments/accounts/payment-accounts.service';
import { ChargesAsaasService } from '../payments/charges/charges-asaas.service';

describe('ChargesService', () => {
  let service: ChargesService;

  const chargesRepo = {
    findById: jest.fn(),
    findByIdWithUnit: jest.fn(),
    findByUnitAndMonth: jest.fn(),
    findByCondo: jest.fn(),
    findByUnits: jest.fn(),
    findPendingWithUnit: jest.fn(),
    countPendingOverdueByCondo: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const unitRepo = { findOne: jest.fn(), find: jest.fn() };
  const condoRepo = { findOne: jest.fn(), find: jest.fn() };
  const tenantMembership = {
    assertAdminOrSub: jest.fn(),
    resolveMineUnitIds: jest.fn(),
    assertUserOwnsUnit: jest.fn(),
    listUnitUserIds: jest.fn().mockResolvedValue([]),
    listAdminUserIds: jest.fn().mockResolvedValue([]),
  };
  const whatsappQueue = { add: jest.fn() };
  const notifications = {
    create: jest.fn(),
    createMany: jest.fn().mockResolvedValue([]),
  };
  const residentRepo = {
    findOne: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
  };
  const paymentAccounts = {
    requireActive: jest.fn().mockResolvedValue({ id: 'pa1' }),
    resolveApiKey: jest.fn().mockResolvedValue('fakekey'),
  };
  const chargesAsaas = {
    emitPayment: jest.fn().mockImplementation(async (c) => c),
    cancelPayment: jest.fn().mockResolvedValue(undefined),
    settleAsReceivedInCash: jest.fn().mockImplementation(async (c) => c),
    fetchPixQrCode: jest.fn().mockResolvedValue(null),
  };
  const logger = {
    warn: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };
  // Quando `ASAAS_ACCOUNTS_ENABLED=false`, ChargesService pula a integração.
  // Mantemos `false` no spec para os testes existentes não dependerem de Asaas.
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ASAAS_ACCOUNTS_ENABLED') return false;
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargesService,
        { provide: ChargesRepository, useValue: chargesRepo },
        { provide: getRepositoryToken(Unit), useValue: unitRepo },
        { provide: getRepositoryToken(Condominium), useValue: condoRepo },
        {
          provide: TenantMembershipService,
          useValue: tenantMembership,
        },
        {
          provide: getQueueToken(QUEUE_WHATSAPP_SEND),
          useValue: whatsappQueue,
        },
        {
          provide: NotificationsService,
          useValue: notifications,
        },
        { provide: getRepositoryToken(Resident), useValue: residentRepo },
        { provide: PaymentAccountsService, useValue: paymentAccounts },
        { provide: ChargesAsaasService, useValue: chargesAsaas },
        { provide: ConfigService, useValue: config },
        { provide: getLoggerToken(ChargesService.name), useValue: logger },
      ],
    }).compile();
    service = module.get(ChargesService);
  });

  it('markPaid bloqueia papéis sem permissão (Forbidden)', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
    });
    tenantMembership.assertAdminOrSub.mockRejectedValue(
      new ForbiddenException(
        'Apenas síndico ou subsíndico podem executar esta ação.',
      ),
    );
    await expect(service.markPaid('u1', 'ch1')).rejects.toThrow(
      /síndico ou subsíndico/,
    );
  });

  it('markPaid sucede para síndico (PENDING → PAID)', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);
    chargesRepo.save.mockImplementation(async (c) => c);
    const out = await service.markPaid('u1', 'ch1', undefined, {
      method: 'MANUAL_CASH',
    });
    expect(out.status).toBe(ChargeStatus.PAID);
    expect(out.paidAt).toBeInstanceOf(Date);
    expect(chargesAsaas.cancelPayment).toHaveBeenCalled();
    expect(out.paidMethod).toBe('MANUAL_CASH');
  });

  it('markPaid bloqueia transição inválida (PAID → PAID)', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PAID,
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);
    await expect(service.markPaid('u1', 'ch1')).rejects.toThrow(
      /Transição de status inválida|já está com status/,
    );
  });

  it('exempt exige justificativa não-vazia', async () => {
    await expect(service.exempt('u1', 'ch1', '   ')).rejects.toThrow(
      /Justificativa é obrigatória/,
    );
  });

  // ── Solicitação de baixa pelo morador ─────────────────────────────────

  it('requestPaymentConfirmation grava request, notifica admins e enfileira WhatsApp', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1', block: 'A', number: '101' },
      status: ChargeStatus.PENDING,
      paymentRequestAt: null,
      billingMonth: '2026-05',
      amount: '180.00',
    });
    tenantMembership.assertUserOwnsUnit.mockResolvedValue(undefined);
    tenantMembership.listAdminUserIds.mockResolvedValue(['admin1']);
    residentRepo.findOne = jest
      .fn()
      .mockResolvedValue({ fullName: 'João da Silva' });
    unitRepo.findOne = jest
      .fn()
      .mockResolvedValue({ block: 'A', number: '101' });
    chargesRepo.save.mockImplementation(async (c: unknown) => c);

    const result = await service.requestPaymentConfirmation(
      'user1',
      'cond1',
      'ch1',
      { method: 'PIX', note: 'pagamento via Itaú' },
    );

    expect(result).toEqual({ requested: true, alreadyRequested: false });
    expect(chargesRepo.save).toHaveBeenCalled();
    expect(notifications.createMany).toHaveBeenCalled();
    expect(whatsappQueue.add).toHaveBeenCalledWith(
      'charge-payment-requested',
      { chargeId: 'ch1' },
      expect.objectContaining({
        jobId: expect.stringMatching(/^charge:ch1:payment-request:/),
      }),
    );
  });

  it('requestPaymentConfirmation é idempotente em janela de 24h', async () => {
    const recent = new Date(Date.now() - 60_000); // 1 min atrás
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1', block: 'A', number: '101' },
      status: ChargeStatus.PENDING,
      paymentRequestAt: recent,
      billingMonth: '2026-05',
      amount: '180.00',
    });
    tenantMembership.assertUserOwnsUnit.mockResolvedValue(undefined);

    const result = await service.requestPaymentConfirmation(
      'user1',
      'cond1',
      'ch1',
      { method: 'PIX' },
    );

    expect(result).toEqual({ requested: true, alreadyRequested: true });
    expect(chargesRepo.save).not.toHaveBeenCalled();
    expect(notifications.createMany).not.toHaveBeenCalled();
    expect(whatsappQueue.add).not.toHaveBeenCalled();
  });

  it('requestPaymentConfirmation bloqueia status não-pendente', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PAID,
      paymentRequestAt: null,
    });
    tenantMembership.assertUserOwnsUnit.mockResolvedValue(undefined);

    await expect(
      service.requestPaymentConfirmation('user1', 'cond1', 'ch1', {
        method: 'PIX',
      }),
    ).rejects.toThrow(/não é possível pedir confirmação/);
  });

  it('markPaidByResident sempre lança 410 com USE_REQUEST_CONFIRMATION', async () => {
    await expect(
      service.markPaidByResident('u1', 'cond1', 'ch1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'USE_REQUEST_CONFIRMATION' }),
    });
  });

  it('rejectPaymentRequest limpa colunas e notifica morador', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
      paymentRequestAt: new Date(),
      paymentRequestMethod: 'PIX',
      paymentRequestUserId: 'morador1',
      billingMonth: '2026-05',
      amount: '180.00',
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);
    chargesRepo.save.mockImplementation(async (c: unknown) => c);

    const saved = await service.rejectPaymentRequest(
      'sindico1',
      'ch1',
      'Pagamento não localizado na conta',
    );

    expect(saved.paymentRequestAt).toBeNull();
    expect(saved.paymentRequestMethod).toBeNull();
    expect(notifications.createMany).toHaveBeenCalled();
  });

  it('rejectPaymentRequest bloqueia quando não há solicitação pendente', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
      paymentRequestAt: null,
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);

    await expect(
      service.rejectPaymentRequest('sindico1', 'ch1', 'motivo válido'),
    ).rejects.toThrow(/Não há solicitação de baixa pendente/);
  });

  // ── markPaid + Asaas receiveInCash ────────────────────────────────────

  it('markPaid com método MANUAL_CASH dispara settleAsReceivedInCash no Asaas', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
      asaasPaymentId: 'pay_abc',
      paymentRequestAt: null,
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);
    chargesRepo.save.mockImplementation(async (c: unknown) => c);

    const out = await service.markPaid('sindico1', 'ch1', undefined, {
      method: 'MANUAL_CASH',
    });

    expect(out.status).toBe(ChargeStatus.PAID);
    expect(chargesAsaas.settleAsReceivedInCash).toHaveBeenCalled();
    expect(chargesAsaas.cancelPayment).not.toHaveBeenCalled();
  });

  it('markPaid com método MANUAL_OTHER mantém cancelPayment (correção/duplicidade)', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
      asaasPaymentId: 'pay_abc',
      paymentRequestAt: null,
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);
    chargesRepo.save.mockImplementation(async (c: unknown) => c);

    await service.markPaid('sindico1', 'ch1', undefined, {
      method: 'MANUAL_OTHER',
    });

    expect(chargesAsaas.cancelPayment).toHaveBeenCalled();
    expect(chargesAsaas.settleAsReceivedInCash).not.toHaveBeenCalled();
  });

  it('markPaid sem asaasPaymentId nunca chama settleAsReceivedInCash', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
      asaasPaymentId: null,
      paymentRequestAt: null,
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);
    chargesRepo.save.mockImplementation(async (c: unknown) => c);

    await service.markPaid('sindico1', 'ch1', undefined, {
      method: 'MANUAL_PIX',
    });

    expect(chargesAsaas.settleAsReceivedInCash).not.toHaveBeenCalled();
    expect(chargesAsaas.cancelPayment).toHaveBeenCalled();
  });

  it('markPaid limpa colunas payment_request_* ao baixar', async () => {
    chargesRepo.findByIdWithUnit.mockResolvedValue({
      id: 'ch1',
      unitId: 'u1',
      unit: { condominiumId: 'cond1' },
      status: ChargeStatus.PENDING,
      asaasPaymentId: null,
      paymentRequestAt: new Date(),
      paymentRequestMethod: 'PIX',
      paymentRequestNote: 'pago',
      paymentRequestUserId: 'morador1',
    });
    tenantMembership.assertAdminOrSub.mockResolvedValue(undefined);
    chargesRepo.save.mockImplementation(async (c: unknown) => c);

    const saved = await service.markPaid('sindico1', 'ch1', undefined, {
      method: 'MANUAL_CASH',
    });

    expect(saved.paymentRequestAt).toBeNull();
    expect(saved.paymentRequestMethod).toBeNull();
    expect(saved.paymentRequestNote).toBeNull();
    expect(saved.paymentRequestUserId).toBeNull();
  });
});
