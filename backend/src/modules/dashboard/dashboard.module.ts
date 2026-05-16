import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulletinPost } from '../../database/entities/bulletin-post.entity';
import { Charge } from '../../database/entities/charge.entity';
import { Condominium } from '../../database/entities/condominium.entity';
import { Expense } from '../../database/entities/expense.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Parcel } from '../../database/entities/parcel.entity';
import { Reservation } from '../../database/entities/reservation.entity';
import { Resident } from '../../database/entities/resident.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';
import { ResidentHomeController } from './resident-home.controller';
import { ResidentHomeService } from './resident-home.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Charge,
      Expense,
      Condominium,
      Parcel,
      Reservation,
      Resident,
      UserCondominium,
      BulletinPost,
      Notification,
    ]),
  ],
  controllers: [DashboardController, ResidentHomeController],
  providers: [DashboardRepository, DashboardService, ResidentHomeService],
  exports: [DashboardRepository],
})
export class DashboardModule {}
