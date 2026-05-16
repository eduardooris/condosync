import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel, ParcelStatus } from '../../database/entities/parcel.entity';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { TenantMembershipService } from '../../common/services/tenant-membership.service';
import {
  VisitorEntry,
  VisitorEntryStatus,
  VisitorEntryType,
} from '../../database/entities/visitor-entry.entity';
import {
  CreateParcelDto,
  CreateVisitorEntryDto,
  UpdateParcelStatusDto,
  UpdateVisitorEntryStatusDto,
} from './dto/visitors.dto';

@Injectable()
export class VisitorsService {
  constructor(
    @InjectRepository(VisitorEntry)
    private readonly visitorRepo: Repository<VisitorEntry>,
    @InjectRepository(Parcel)
    private readonly parcelRepo: Repository<Parcel>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    private readonly tenantMembership: TenantMembershipService,
  ) {}

  async listVisitors(condominiumId: string): Promise<VisitorEntry[]> {
    return this.visitorRepo.find({
      where: { condominiumId },
      order: { expectedAt: 'ASC' },
    });
  }

  async createVisitor(
    userId: string,
    condominiumId: string,
    dto: CreateVisitorEntryDto,
  ): Promise<VisitorEntry> {
    const unit = await this.unitRepo.findOne({
      where: { id: dto.unitId, condominiumId },
    });
    if (!unit) throw new NotFoundException('Unidade não encontrada.');
    const resident = await this.tenantMembership.findResidentOnOwnedUnit(
      userId,
      condominiumId,
      dto.unitId,
    );
    const row = this.visitorRepo.create({
      condominiumId,
      unitId: dto.unitId,
      residentId: resident.id,
      visitorName: dto.visitorName.trim(),
      visitorDocument: dto.visitorDocument?.trim() || null,
      expectedAt: new Date(dto.expectedAt),
      notes: dto.notes?.trim() || null,
      status: VisitorEntryStatus.EXPECTED,
      type: dto.type ?? VisitorEntryType.VISITA,
    });
    return this.visitorRepo.save(row);
  }

  async updateVisitorStatus(
    userId: string,
    condominiumId: string,
    id: string,
    dto: UpdateVisitorEntryStatusDto,
  ): Promise<VisitorEntry> {
    await this.assertAdmin(userId, condominiumId);
    const row = await this.visitorRepo.findOne({
      where: { id, condominiumId },
    });
    if (!row) throw new NotFoundException('Visitante não encontrado.');
    row.status = dto.status;
    return this.visitorRepo.save(row);
  }

  async listParcels(condominiumId: string): Promise<Parcel[]> {
    return this.parcelRepo.find({
      where: { condominiumId },
      order: { receivedAt: 'DESC' },
    });
  }

  async createParcel(
    userId: string,
    condominiumId: string,
    dto: CreateParcelDto,
  ): Promise<Parcel> {
    await this.assertAdmin(userId, condominiumId);
    const unit = await this.unitRepo.findOne({
      where: { id: dto.unitId, condominiumId },
    });
    if (!unit) throw new NotFoundException('Unidade não encontrada.');
    let residentId: string | null = null;
    if (dto.residentId) {
      const resident = await this.residentRepo.findOne({
        where: { id: dto.residentId, unitId: dto.unitId },
      });
      if (!resident) {
        throw new BadRequestException(
          'Morador informado não pertence à unidade selecionada.',
        );
      }
      residentId = resident.id;
    }
    const row = this.parcelRepo.create({
      condominiumId,
      unitId: dto.unitId,
      residentId,
      carrier: dto.carrier.trim(),
      trackingCode: dto.trackingCode?.trim() || null,
      notes: dto.notes?.trim() || null,
      status: ParcelStatus.RECEIVED,
      receivedAt: new Date(),
    });
    return this.parcelRepo.save(row);
  }

  async updateParcelStatus(
    userId: string,
    condominiumId: string,
    id: string,
    dto: UpdateParcelStatusDto,
  ): Promise<Parcel> {
    await this.assertAdmin(userId, condominiumId);
    const row = await this.parcelRepo.findOne({ where: { id, condominiumId } });
    if (!row) throw new NotFoundException('Correspondência não encontrada.');
    row.status = dto.status;
    row.deliveredAt = dto.status === ParcelStatus.DELIVERED ? new Date() : null;
    return this.parcelRepo.save(row);
  }

  private async assertAdmin(
    userId: string,
    condominiumId: string,
  ): Promise<void> {
    await this.tenantMembership.assertAdminOrSub(userId, condominiumId);
  }
}
