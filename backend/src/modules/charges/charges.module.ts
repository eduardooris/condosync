import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Charge } from '../../database/entities/charge.entity';
import { Unit } from '../../database/entities/unit.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ChargesService } from './charges.service';
import {
  CondominiumChargesController,
  CondominiumMyChargesController,
} from './charges.controller';
import { ChargeActionsController } from './charge-actions.controller';
import { ChargesSchedulerService } from './charges.scheduler';
import { ChargesRepository } from './charges.repository';
import { ChargesGenerationProcessor } from './processors/charges-generation.processor';
import { OverdueCheckProcessor } from './processors/overdue-check.processor';
import { BalanceCheckProcessor } from './processors/balance-check.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Charge, Unit, Condominium]),
    DashboardModule,
  ],
  controllers: [
    // Rotas do morador (`.../charges/mine`) antes do admin (`.../charges/:chargeId`).
    // Se invertido, Express trata `mine` como UUID e o RolesGuard devolve 403.
    CondominiumMyChargesController,
    CondominiumChargesController,
    ChargeActionsController,
  ],
  providers: [
    ChargesRepository,
    ChargesService,
    ChargesSchedulerService,
    ChargesGenerationProcessor,
    OverdueCheckProcessor,
    BalanceCheckProcessor,
  ],
  exports: [ChargesService, ChargesRepository],
})
export class ChargesModule {}
