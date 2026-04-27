import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCondominium } from '../database/entities/user-condominium.entity';
import { AuthModule } from '../modules/auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CondominiumMemberGuard } from '../common/guards/condominium-member.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Global()
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserCondominium])],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    CondominiumMemberGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    CondominiumMemberGuard,
    TypeOrmModule,
    AuthModule,
  ],
})
export class CoreModule {}
