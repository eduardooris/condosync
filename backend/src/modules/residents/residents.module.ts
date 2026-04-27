import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { User } from '../../database/entities/user.entity';
import { FinancialResponsibleHistory } from '../../database/entities/financial-responsible-history.entity';
import {
  MyResidentProfileController,
  NeighborsController,
  ResidentsController,
} from './residents.controller';
import { ResidentsService } from './residents.service';
import { ResidentsRepository } from './residents.repository';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Resident,
      Unit,
      UserCondominium,
      User,
      FinancialResponsibleHistory,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [
    ResidentsController,
    NeighborsController,
    MyResidentProfileController,
  ],
  providers: [ResidentsRepository, ResidentsService],
  exports: [ResidentsService, ResidentsRepository],
})
export class ResidentsModule {}
