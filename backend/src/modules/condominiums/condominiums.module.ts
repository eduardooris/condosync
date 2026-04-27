import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Condominium } from '../../database/entities/condominium.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { Unit } from '../../database/entities/unit.entity';
import { User } from '../../database/entities/user.entity';
import { Resident } from '../../database/entities/resident.entity';
import { CondominiumsController } from './condominiums.controller';
import { CondominiumsService } from './condominiums.service';
import { CondominiumsRepository } from './condominiums.repository';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { ChargesModule } from '../charges/charges.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Condominium,
      UserCondominium,
      Unit,
      User,
      Resident,
    ]),
    ChargesModule,
    AuthModule,
  ],
  controllers: [CondominiumsController, MembersController],
  providers: [CondominiumsRepository, CondominiumsService, MembersService],
  exports: [CondominiumsService, CondominiumsRepository],
})
export class CondominiumsModule {}
