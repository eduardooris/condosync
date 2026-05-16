import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationArea } from '../../database/entities/reservation-area.entity';
import { Reservation } from '../../database/entities/reservation.entity';
import { Unit } from '../../database/entities/unit.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReservationArea, Reservation, Unit])],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
