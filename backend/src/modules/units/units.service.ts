import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { Charge } from '../../database/entities/charge.entity';
import {
  CondominiumInvitation,
  InvitationStatus,
} from '../../database/entities/condominium-invitation.entity';
import { ChargeStatus } from '../../common/enums';
import { Unit } from '../../database/entities/unit.entity';
import { UnitStatus, UnitType } from '../../common/enums';
import { Resident } from '../../database/entities/resident.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsRepository } from './units.repository';
import { UnitOnboardingChecklistItemDto } from './dto/unit-onboarding.dto';

@Injectable()
export class UnitsService {
  constructor(
    private readonly unitsRepo: UnitsRepository,
    @InjectRepository(Resident)
    private readonly residentsRepo: Repository<Resident>,
    @InjectRepository(CondominiumInvitation)
    private readonly invitationsRepo: Repository<CondominiumInvitation>,
    @InjectRepository(Charge)
    private readonly chargesRepo: Repository<Charge>,
  ) {}

  async create(condominiumId: string, dto: CreateUnitDto): Promise<Unit> {
    const unit = this.unitsRepo.create({
      condominiumId,
      block: dto.block,
      number: dto.number,
      type: dto.type ?? UnitType.APARTMENT,
      status: dto.status ?? UnitStatus.VACANT,
    });
    try {
      return await this.unitsRepo.save(unit);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        throw new BadRequestException('Unit block+number already exists');
      }
      throw e;
    }
  }

  async list(condominiumId: string): Promise<Unit[]> {
    return this.unitsRepo.findAll(condominiumId);
  }

  async findOneInCondo(condominiumId: string, unitId: string): Promise<Unit> {
    const u = await this.unitsRepo.findById(unitId, condominiumId);
    if (!u) {
      throw new NotFoundException('Unidade não encontrada.');
    }
    return u;
  }

  async update(
    condominiumId: string,
    unitId: string,
    dto: UpdateUnitDto,
  ): Promise<Unit> {
    const unit = await this.findOneInCondo(condominiumId, unitId);
    if (dto.status === UnitStatus.VACANT) {
      const residentsCount = await this.residentsRepo.count({
        where: { unitId },
      });
      if (residentsCount > 0) {
        throw new BadRequestException(
          'Unidade com morador não pode ser marcada como vaga.',
        );
      }
    }
    if (dto.block !== undefined) unit.block = dto.block;
    if (dto.number !== undefined) unit.number = dto.number;
    if (dto.type !== undefined) unit.type = dto.type;
    if (dto.status !== undefined) unit.status = dto.status;
    return this.unitsRepo.save(unit);
  }

  async importCsv(
    condominiumId: string,
    csv: string,
  ): Promise<{ count: number }> {
    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    let count = 0;
    await this.unitsRepo.transaction(async (em) => {
      for (const row of records) {
        const block = row.block ?? row.Bloco ?? row.bloco;
        const number = row.number ?? row.Numero ?? row.numero ?? row.número;
        if (!block || !number) {
          continue;
        }
        const typeRaw = (row.type ?? row.tipo ?? 'APARTMENT').toUpperCase();
        const type =
          typeRaw in UnitType ? (typeRaw as UnitType) : UnitType.APARTMENT;
        const statusRaw = (row.status ?? row.Status ?? 'VACANT').toUpperCase();
        const status =
          statusRaw in UnitStatus
            ? (statusRaw as UnitStatus)
            : UnitStatus.VACANT;
        await em.getRepository(Unit).upsert(
          {
            condominiumId,
            block: String(block),
            number: String(number),
            type,
            status,
          },
          ['condominiumId', 'block', 'number'],
        );
        count += 1;
      }
    });
    return { count };
  }

  async onboardingChecklist(
    condominiumId: string,
  ): Promise<UnitOnboardingChecklistItemDto[]> {
    const units = await this.unitsRepo.findAll(condominiumId);
    if (units.length === 0) return [];
    const unitIds = units.map((u) => u.id);
    const residents = await this.residentsRepo.find({
      where: unitIds.map((unitId) => ({ unitId })),
    });
    const activeInvitations = await this.invitationsRepo.find({
      where: unitIds.map((unitId) => ({
        unitId,
        status: InvitationStatus.ACTIVE,
      })),
    });
    const currentMonth = this.currentBillingMonth();
    const currentMonthCharges = await this.chargesRepo.find({
      where: unitIds.map((unitId) => ({
        unitId,
        billingMonth: currentMonth,
      })),
    });

    return units.map((unit) => {
      const unitResidents = residents.filter((r) => r.unitId === unit.id);
      const hasResidents = unitResidents.length > 0;
      const hasFinancialResponsible = unitResidents.some(
        (r) => r.isFinancialResponsible,
      );
      const hasActiveAppAccess = unitResidents.some((r) => Boolean(r.userId));
      const hasPendingInvitation = activeInvitations.some(
        (inv) => inv.unitId === unit.id,
      );
      const hasCurrentMonthCharge = currentMonthCharges.some(
        (charge) =>
          charge.unitId === unit.id && charge.status !== ChargeStatus.CANCELED,
      );
      const score = [
        hasResidents,
        hasFinancialResponsible,
        hasActiveAppAccess,
        hasPendingInvitation || hasActiveAppAccess,
        hasCurrentMonthCharge,
      ].filter(Boolean).length;
      const isReady =
        hasResidents &&
        hasFinancialResponsible &&
        (hasActiveAppAccess || hasPendingInvitation);
      return {
        unitId: unit.id,
        block: unit.block,
        number: unit.number,
        hasResidents,
        hasFinancialResponsible,
        hasActiveAppAccess,
        hasPendingInvitation,
        hasCurrentMonthCharge,
        score,
        isReady,
      };
    });
  }

  private currentBillingMonth(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    });
    const [{ value: y }, , { value: m }] = formatter.formatToParts(new Date());
    return `${y}-${m}`;
  }
}
