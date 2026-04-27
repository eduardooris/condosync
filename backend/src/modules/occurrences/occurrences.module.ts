import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Occurrence } from '../../database/entities/occurrence.entity';
import { Resident } from '../../database/entities/resident.entity';
import { Unit } from '../../database/entities/unit.entity';
import { StorageAdapterModule } from '../../adapters/adapters.module';
import { OccurrencesController } from './occurrences.controller';
import { OccurrencesService } from './occurrences.service';
import { OccurrencesRepository } from './occurrences.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Occurrence, Resident, Unit]),
    StorageAdapterModule,
  ],
  controllers: [OccurrencesController],
  providers: [OccurrencesRepository, OccurrencesService],
})
export class OccurrencesModule {}
