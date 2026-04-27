import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitorEntry } from '../../database/entities/visitor-entry.entity';
import { Parcel } from '../../database/entities/parcel.entity';
import { Unit } from '../../database/entities/unit.entity';
import { Resident } from '../../database/entities/resident.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisitorEntry,
      Parcel,
      Unit,
      Resident,
      UserCondominium,
    ]),
  ],
  controllers: [VisitorsController],
  providers: [VisitorsService],
})
export class VisitorsModule {}
