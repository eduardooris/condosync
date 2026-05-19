import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCondominium } from '../database/entities/user-condominium.entity';
import { Condominium } from '../database/entities/condominium.entity';
import { Resident } from '../database/entities/resident.entity';
import { AuthModule } from '../modules/auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CondominiumMemberGuard } from '../common/guards/condominium-member.guard';
import { CondominiumMemberOrMasterGuard } from '../common/guards/condominium-member-or-master.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MessageServerInternalGuard } from '../common/guards/message-server-internal.guard';
import { TenantMembershipService } from '../common/services/tenant-membership.service';

@Global()
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([UserCondominium, Condominium, Resident]),
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    CondominiumMemberGuard,
    CondominiumMemberOrMasterGuard,
    MessageServerInternalGuard,
    TenantMembershipService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    CondominiumMemberGuard,
    CondominiumMemberOrMasterGuard,
    MessageServerInternalGuard,
    TenantMembershipService,
    TypeOrmModule,
    AuthModule,
  ],
})
export class CoreModule {}
