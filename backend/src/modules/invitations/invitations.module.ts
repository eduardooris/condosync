import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CondominiumInvitation } from '../../database/entities/condominium-invitation.entity';
import { Resident } from '../../database/entities/resident.entity';
import { UserCondominium } from '../../database/entities/user-condominium.entity';
import { Unit } from '../../database/entities/unit.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import {
  CondominiumInvitationsController,
  InvitationsPublicController,
} from './invitations.controller';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CondominiumInvitation,
      UserCondominium,
      Unit,
      Resident,
    ]),
    AuthModule,
    UsersModule,
  ],
  controllers: [CondominiumInvitationsController, InvitationsPublicController],
  providers: [InvitationsRepository, InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
