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
  const residentRepo = { findOne: jest.fn(), count: jest.fn().mockResolvedValue(1) };
  const paymentAccounts = {
    requireActive: jest.fn().mockResolvedValue({ id: 'pa1' }),
    resolveApiKey: jest.fn().mockResolvedValue('fakekey'),
  };
  const chargesAsaas = {
    emitPayment: jest.fn().mockImplementation(async (c) => c),
    cancelPayment: jest.fn().mockResolvedValue(undefined),
    fetchPixQrCode: jest.fn().mockResolvedValue(null),
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
    const out = await service.markPaid('u1', 'ch1');
    expect(out.status).toBe(ChargeStatus.PAID);
    expect(out.paidAt).toBeInstanceOf(Date);
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
});
