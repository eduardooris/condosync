import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Charge } from '../../database/entities/charge.entity';
import { Expense } from '../../database/entities/expense.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Charge, Expense])],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
  exports: [DashboardRepository],
})
export class DashboardModule {}
