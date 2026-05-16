import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitorEntry } from '../../database/entities/visitor-entry.entity';
import { Parcel } from '../../database/entities/parcel.entity';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { IntercomModule } from './intercom/intercom.module';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisitorEntry, Parcel, Unit, Resident]),
    IntercomModule,
  ],
  controllers: [VisitorsController],
  providers: [VisitorsService],
})
export class VisitorsModule {}
