import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { CondominiumsService } from './condominiums.service';
import { CondominiumsRepository } from './condominiums.repository';
import { ChargesRepository } from '../charges/charges.repository';
import { Unit } from '../../database/entities/unit.entity';
import { User } from '../../database/entities/user.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { UserRole } from '../../common/enums';

describe('CondominiumsService', () => {
  let service: CondominiumsService;
  let condosRepo: Record<string, jest.Mock>;
  let chargesRepo: Record<string, jest.Mock>;
  let condoEntityRepo: Record<string, jest.Mock>;
  let ucEntityRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    condosRepo = {
      createCondo: jest.fn((x) => x),
      saveCondo: jest.fn(async (x) => {
        Object.assign(x, { id: 'c1' });
        return x;
      }),
      findById: jest.fn(),
      findByUser: jest.fn(),
      findMembership: jest.fn(),
      createMembership: jest.fn((x) => x),
      saveMembership: jest.fn(async (x) => x),
      findActive: jest.fn(),
    };
    chargesRepo = {
      countPendingOverdueByCondo: jest.fn(),
    };

    condoEntityRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => {
        Object.assign(x, { id: 'c1' });
        return x;
      }),
    };
    ucEntityRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };

    const manager = {
      getRepository: jest.fn((entity) =>
        entity === Condominium ? condoEntityRepo : ucEntityRepo,
      ),
    };
    const dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) =>
        cb(manager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CondominiumsService,
        { provide: CondominiumsRepository, useValue: condosRepo },
        { provide: ChargesRepository, useValue: chargesRepo },
        { provide: getRepositoryToken(Unit), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get(CondominiumsService);
  });

  it('create assigns creator as ADMIN', async () => {
    const dto = {
      name: 'Cond',
      cnpj: '12.345.678/0001-90',
    };
    const result = await service.create('user-1', dto as never);
    expect(result.id).toBe('c1');
    expect(ucEntityRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        role: UserRole.ADMIN,
      }),
    );
  });
});
