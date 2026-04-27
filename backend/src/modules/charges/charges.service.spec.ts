import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ChargesService } from './charges.service';
import { ChargesRepository } from './charges.repository';
import { Unit } from '../../database/entities/unit.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { Resident } from '../../database/entities/resident.entity';
import { ChargeStatus, UserRole } from '../../common/enums';
import { QUEUE_WHATSAPP_SEND } from '../../queues/queue-names';

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
  const ucRepo = { findOne: jest.fn() };
  const residentRepo = { createQueryBuilder: jest.fn() };
  const whatsappQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargesService,
        { provide: ChargesRepository, useValue: chargesRepo },
        { provide: getRepositoryToken(Unit), useValue: unitRepo },
        { provide: getRepositoryToken(Condominium), useValue: condoRepo },
        { provide: getRepositoryToken(UserCondominium), useValue: ucRepo },
        { provide: getRepositoryToken(Resident), useValue: residentRepo },
        {
          provide: getQueueToken(QUEUE_WHATSAPP_SEND),
          useValue: whatsappQueue,
        },
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
    ucRepo.findOne.mockResolvedValue({ role: UserRole.RESIDENT });
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
    ucRepo.findOne.mockResolvedValue({ role: UserRole.ADMIN });
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
    ucRepo.findOne.mockResolvedValue({ role: UserRole.ADMIN });
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
