import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import { IsNull, Repository } from 'typeorm';
import {
  QUEUE_BALANCE_CHECK,
  QUEUE_WHATSAPP_SEND,
} from '../../../queues/queue-names';
import { Condominium } from '../../../database/entities/condominium.entity';
import { Resident } from '../../../database/entities/resident.entity';
import { UserCondominium } from '../../../database/entities/user-condominium.entity';
import { UserRole } from '../../../common/enums';
import { DashboardRepository } from '../../dashboard/dashboard.repository';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../../database/entities/notification.entity';

/**
 * RN-03.4 — todo dia de manhã, somar receitas (cobranças PAID) e
 * despesas (APPROVED) por condomínio. Se receitas - despesas < 0,
 * notificar todos os síndicos via WhatsApp + in-app.
 */
@Processor(QUEUE_BALANCE_CHECK)
export class BalanceCheckProcessor {
  private readonly logger = new Logger(BalanceCheckProcessor.name);

  constructor(
    @InjectRepository(Condominium)
    private readonly condoRepo: Repository<Condominium>,
    @InjectRepository(UserCondominium)
    private readonly membershipRepo: Repository<UserCondominium>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    private readonly dashboard: DashboardRepository,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUE_WHATSAPP_SEND)
    private readonly whatsappQueue: Queue,
  ) {}

  @Process('run')
  async handle(_job: Job): Promise<void> {
    const condos = await this.condoRepo.find({
      where: { archivedAt: IsNull() },
    });
    this.logger.log(
      `Verificando saldo negativo de ${condos.length} condomínios`,
    );
    for (const condo of condos) {
      try {
        await this.checkOne(condo);
      } catch (err) {
        this.logger.error(
          `Erro ao verificar saldo do condomínio ${condo.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async checkOne(condo: Condominium): Promise<void> {
    const [paid, approved] = await Promise.all([
      this.dashboard.sumPaidCharges(condo.id),
      this.dashboard.sumApprovedExpenses(condo.id),
    ]);
    const balance = Number(paid?.total ?? 0) - Number(approved?.total ?? 0);
    if (balance >= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const admins = await this.membershipRepo.find({
      where: { condominiumId: condo.id, role: UserRole.ADMIN },
    });
    if (admins.length === 0) return;
    const message = `CondoSync: o saldo financeiro do ${condo.name} está negativo (R$ ${balance.toFixed(2)}). Verifique receitas x despesas.`;
    await this.notifications.createMany(
      admins.map((a) => ({
        userId: a.userId,
        condominiumId: condo.id,
        type: NotificationType.BALANCE_NEGATIVE,
        title: 'Saldo negativo no condomínio',
        body: message,
        payload: { balance, day: today },
      })),
    );
    const adminUserIds = admins.map((a) => a.userId);
    if (adminUserIds.length === 0) return;
    const responsibles = await this.residentRepo
      .createQueryBuilder('r')
      .innerJoin('r.unit', 'u')
      .where('u.condominium_id = :condominiumId', { condominiumId: condo.id })
      .andWhere('r.user_id IN (:...adminUserIds)', { adminUserIds })
      .getMany();
    for (const r of responsibles) {
      if (!r.phoneWhatsapp) continue;
      await this.whatsappQueue.add(
        'balance-negative',
        { phone: r.phoneWhatsapp, message },
        { jobId: `balance:${condo.id}:${today}:${r.id}` },
      );
    }
  }
}
