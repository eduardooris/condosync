import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Unit } from '../../database/entities/unit.entity';
import { User } from '../../database/entities/user.entity';
import { PixKeyType, UnitStatus, UserRole } from '../../common/enums';
import {
  isValidBrazilWhatsapp,
  normalizeBrazilWhatsapp,
} from '../../common/utils/br-documents';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';
import { Condominium } from '../../database/entities/condominium.entity';
import {
  MembershipStatus,
  UserCondominium,
} from '../../database/entities/user-condominium.entity';
import { CondominiumsRepository } from './condominiums.repository';
import { ChargesRepository } from '../charges/charges.repository';

@Injectable()
export class CondominiumsService {
  constructor(
    private readonly condosRepo: CondominiumsRepository,
    private readonly chargesRepo: ChargesRepository,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cria um condomínio + membership do criador (ADMIN) numa única
   * transação. Sem transação um condomínio órfão poderia ser criado
   * caso a inserção do `UserCondominium` falhasse — quebrando a
   * invariante de que todo condomínio precisa ter ao menos um síndico.
   */
  async create(
    userId: string,
    dto: CreateCondominiumDto,
  ): Promise<Condominium> {
    return this.dataSource.transaction(async (manager) => {
      const condoRepo = manager.getRepository(Condominium);
      const ucRepo = manager.getRepository(UserCondominium);
      const cnpjDigits = dto.cnpj?.replace(/\D/g, '') ?? '';
      if (cnpjDigits && ![11, 14].includes(cnpjDigits.length)) {
        // Cobre o caso de cliente legacy enviando "12345" — aceitar lixo é pior.
        throw new BadRequestException(
          'CPF/CNPJ inválido — informe 11 dígitos (CPF) ou 14 (CNPJ).',
        );
      }
      const condo = condoRepo.create({
        name: dto.name,
        cnpj: cnpjDigits || null,
        address: dto.address ?? null,
        photoUrl: dto.photoUrl ?? null,
        monthlyFeeAmount: String(dto.monthlyFeeAmount ?? 0),
        billingGenerationDay: dto.billingGenerationDay ?? 1,
        billingDueDay: dto.billingDueDay ?? 10,
        pixKeyType: dto.pixKeyType ?? null,
        pixKeyValue: this.normalizePixKey(dto.pixKeyType, dto.pixKeyValue),
        adminContactPhone: this.normalizeAdminContactPhone(
          dto.adminContactPhone,
        ),
      });
      const saved = await condoRepo.save(condo);
      await ucRepo.save(
        ucRepo.create({
          userId,
          condominiumId: saved.id,
          role: UserRole.ADMIN,
          status: MembershipStatus.APPROVED,
        }),
      );
      return saved;
    });
  }

  async listMine(
    userId: string,
  ): Promise<Array<Condominium & { role: UserRole; unitId: string | null }>> {
    const links = await this.condosRepo.findByUser(userId);
    return links
      .filter((l) => !l.condominium.archivedAt)
      .map((l) => ({
        ...l.condominium,
        role: l.role,
        unitId: l.unitId,
      }));
  }

  /**
   * Lista memberships PENDING do usuário para que o front possa exibir
   * "aguardando aprovação" sem revelar dados sensíveis do condomínio.
   */
  async listPendingMemberships(
    userId: string,
  ): Promise<Array<{ condominiumId: string; condominiumName: string }>> {
    const links = await this.condosRepo.findPendingByUser(userId);
    return links.map((l) => ({
      condominiumId: l.condominiumId,
      condominiumName: l.condominium.name,
    }));
  }

  async findOne(condominiumId: string): Promise<Condominium> {
    const c = await this.condosRepo.findById(condominiumId);
    if (!c) {
      throw new NotFoundException('Condomínio não encontrado.');
    }
    return c;
  }

  async update(
    condominiumId: string,
    dto: UpdateCondominiumDto,
  ): Promise<Condominium> {
    const condo = await this.findOne(condominiumId);
    if (dto.name !== undefined) condo.name = dto.name;
    // `cnpj` mudança: só `null → algo` ou `algo → null`. Trocar de um valor
    // existente por outro é regra fiscal e requer operação dedicada — aqui
    // bloqueamos pra evitar PATCH acidental quebrar conciliação.
    if (dto.cnpj !== undefined) {
      const cnpjDigits = dto.cnpj?.replace(/\D/g, '') ?? '';
      if (cnpjDigits && ![11, 14].includes(cnpjDigits.length)) {
        throw new BadRequestException(
          'CPF/CNPJ inválido — informe 11 dígitos (CPF) ou 14 (CNPJ).',
        );
      }
      const next = cnpjDigits || null;
      if (condo.cnpj && next && condo.cnpj !== next) {
        throw new BadRequestException(
          'CPF/CNPJ do condomínio só pode ser alterado quando estiver em branco. Contate o suporte para trocar um documento já cadastrado.',
        );
      }
      condo.cnpj = next;
    }
    if (dto.address !== undefined) condo.address = dto.address ?? null;
    if (dto.photoUrl !== undefined) condo.photoUrl = dto.photoUrl ?? null;
    if (dto.monthlyFeeAmount !== undefined) {
      condo.monthlyFeeAmount = String(dto.monthlyFeeAmount);
    }
    if (dto.billingGenerationDay !== undefined) {
      condo.billingGenerationDay = dto.billingGenerationDay;
    }
    if (dto.billingDueDay !== undefined) {
      condo.billingDueDay = dto.billingDueDay;
    }
    if (dto.pixKeyType !== undefined || dto.pixKeyValue !== undefined) {
      const raw = (dto.pixKeyValue ?? '').trim();
      if (!raw) {
        condo.pixKeyType = null;
        condo.pixKeyValue = null;
      } else {
        const nextType = dto.pixKeyType ?? condo.pixKeyType;
        if (!nextType) {
          throw new BadRequestException(
            'Informe o tipo da chave Pix junto com o valor.',
          );
        }
        condo.pixKeyType = nextType;
        condo.pixKeyValue = this.normalizePixKey(nextType, raw);
      }
    }
    if (dto.adminContactPhone !== undefined) {
      condo.adminContactPhone = this.normalizeAdminContactPhone(
        dto.adminContactPhone,
      );
    }
    return this.condosRepo.saveCondo(condo);
  }

  async archive(condominiumId: string): Promise<Condominium> {
    await this.assertCanArchive(condominiumId);
    const condo = await this.findOne(condominiumId);
    condo.archivedAt = new Date();
    return this.condosRepo.saveCondo(condo);
  }

  async unarchive(condominiumId: string): Promise<Condominium> {
    const condo = await this.findOne(condominiumId);
    condo.archivedAt = null;
    return this.condosRepo.saveCondo(condo);
  }

  private async assertCanArchive(condominiumId: string): Promise<void> {
    const occupied = await this.unitRepo.count({
      where: { condominiumId, status: UnitStatus.OCCUPIED },
    });
    if (occupied > 0) {
      throw new BadRequestException(
        'Não é possível arquivar um condomínio com unidades ocupadas.',
      );
    }
    const pending =
      await this.chargesRepo.countPendingOverdueByCondo(condominiumId);
    if (pending > 0) {
      throw new BadRequestException(
        'Não é possível arquivar um condomínio com cobranças em aberto ou vencidas.',
      );
    }
  }

  async addMember(
    condominiumId: string,
    email: string,
    role: UserRole,
  ): Promise<UserCondominium> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException(
        'Não existe usuário cadastrado com este e-mail.',
      );
    }
    const existing = await this.condosRepo.findMembership(
      user.id,
      condominiumId,
    );
    if (existing) {
      existing.role = role;
      return this.condosRepo.saveMembership(existing);
    }
    return this.condosRepo.saveMembership(
      this.condosRepo.createMembership({
        userId: user.id,
        condominiumId,
        role,
      }),
    );
  }

  private normalizePixKey(
    type: PixKeyType | undefined | null,
    value: string | undefined | null,
  ): string | null {
    const raw = value?.trim() ?? '';
    if (!type && !raw) return null;
    if (!type || !raw) {
      throw new BadRequestException(
        'Tipo e valor da chave Pix devem ser informados juntos.',
      );
    }
    switch (type) {
      case PixKeyType.CPF: {
        const digits = raw.replace(/\D/g, '');
        if (digits.length !== 11) {
          throw new BadRequestException('Chave Pix CPF inválida.');
        }
        return digits;
      }
      case PixKeyType.CNPJ: {
        const digits = raw.replace(/\D/g, '');
        if (digits.length !== 14) {
          throw new BadRequestException('Chave Pix CNPJ inválida.');
        }
        return digits;
      }
      case PixKeyType.PHONE: {
        const digits = raw.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 13) {
          throw new BadRequestException('Chave Pix telefone inválida.');
        }
        return digits;
      }
      case PixKeyType.EMAIL: {
        const email = raw.toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new BadRequestException('Chave Pix e-mail inválida.');
        }
        return email;
      }
      case PixKeyType.EVP: {
        if (!/^[0-9a-fA-F-]{36}$/.test(raw)) {
          throw new BadRequestException('Chave Pix aleatória (EVP) inválida.');
        }
        return raw.toLowerCase();
      }
      default:
        throw new BadRequestException('Tipo de chave Pix inválido.');
    }
  }

  private normalizeAdminContactPhone(
    phone: string | undefined | null,
  ): string | null {
    const raw = phone?.trim() ?? '';
    if (!raw) return null;
    if (!isValidBrazilWhatsapp(raw)) {
      throw new BadRequestException(
        'Telefone da administração inválido. Informe DDD + número.',
      );
    }
    return normalizeBrazilWhatsapp(raw);
  }
}
