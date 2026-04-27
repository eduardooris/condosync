import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_ADAPTER } from '../../adapters/auth/auth.adapter';
import { KeycloakAdminClient } from '../../adapters/auth/keycloak-admin.client';
import { KeycloakAuthAdapter } from '../../adapters/auth/keycloak-auth.adapter';
import { Resident } from '../../database/entities/resident.entity';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    TypeOrmModule.forFeature([Resident, PasswordResetToken]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    KeycloakAdminClient,
    KeycloakAuthAdapter,
    { provide: AUTH_ADAPTER, useExisting: KeycloakAuthAdapter },
  ],
  exports: [AuthService, AUTH_ADAPTER, KeycloakAdminClient],
})
export class AuthModule {}
