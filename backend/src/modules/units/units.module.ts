import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Charge } from '../../database/entities/charge.entity';
import { CondominiumInvitation } from '../../database/entities/condominium-invitation.entity';
import { Unit } from '../../database/entities/unit.entity';
import { Resident } from '../../database/entities/resident.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { UnitsRepository } from './units.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Unit, Resident, Charge, CondominiumInvitation]),
  ],
  controllers: [UnitsController],
  providers: [UnitsRepository, UnitsService],
  exports: [UnitsService, UnitsRepository],
})
export class UnitsModule {}
