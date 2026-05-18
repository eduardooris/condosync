import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv, Env } from './config/env.schema';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CondominiumsModule } from './modules/condominiums/condominiums.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { UnitsModule } from './modules/units/units.module';
import { ResidentsModule } from './modules/residents/residents.module';
import { ChargesModule } from './modules/charges/charges.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PollsModule } from './modules/polls/polls.module';
import { OccurrencesModule } from './modules/occurrences/occurrences.module';
import { BulletinModule } from './modules/bulletin/bulletin.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { QueuesModule } from './queues/queues.module';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
} from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (cfg) => validateEnv(cfg),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            // Em dev usamos pino-pretty; em prod JSON puro.
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss.l',
                    ignore: 'pid,hostname,req,res,responseTime',
                  },
                },
            customProps: (req) => ({
              requestId: (req.headers[REQUEST_ID_HEADER] as string) ?? null,
            }),
            // Reduz ruído com healthchecks do Docker e Swagger.
            autoLogging: {
              ignore: (req) => {
                const url = req.url ?? '';
                return (
                  url.startsWith('/api/v1/health') ||
                  url.startsWith('/api/health') ||
                  url.startsWith('/api/docs') ||
                  url.startsWith('/api/openapi')
                );
              },
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
              ],
              remove: true,
            },
          },
        };
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProd = config.get('NODE_ENV', { infer: true }) === 'production';
        return {
          type: 'postgres',
          url: config.get('DATABASE_URL', { infer: true }),
          autoLoadEntities: true,
          // Em produção o schema é sempre gerenciado por migrations
          // (`migrationsRun: true`, `synchronize: false`). Em dev o
          // `synchronize` fica LIGADO por padrão para acelerar o
          // setup; pode ser desligado com `TYPEORM_SYNC=false`.
          synchronize: !isProd && process.env.TYPEORM_SYNC !== 'false',
          migrationsRun: isProd,
          migrations: [__dirname + '/database/migrations/*.{js,ts}'],
          migrationsTransactionMode: 'each',
          logging: false,
        };
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        redis: config.get('REDIS_URL', { infer: true }),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 60 * 60, count: 1000 },
          removeOnFail: { age: 24 * 60 * 60, count: 5000 },
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          name: 'default',
          ttl: config.get('THROTTLE_TTL', { infer: true }) * 1000,
          limit: config.get('THROTTLE_LIMIT', { infer: true }),
        },
        {
          name: 'auth',
          ttl: config.get('THROTTLE_TTL', { infer: true }) * 1000,
          limit: config.get('THROTTLE_AUTH_LIMIT', { infer: true }),
        },
        {
          // RN-10.10: limite específico por (IP, accessToken) na criação
          // de sessões de portaria. Aplicado via
          // `IntercomPublicThrottlerGuard` no controller público.
          name: 'intercom-sessions',
          ttl:
            config.get('INTERCOM_PUBLIC_RATE_TTL_SEC', { infer: true }) * 1000,
          limit: config.get('INTERCOM_PUBLIC_RATE_LIMIT', { infer: true }),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    QueuesModule,
    NotificationsModule,
    IntegrationsModule,
    CoreModule,
    UsersModule,
    AuthModule,
    CondominiumsModule,
    InvitationsModule,
    UnitsModule,
    ResidentsModule,
    ChargesModule,
    ExpensesModule,
    DocumentsModule,
    PollsModule,
    ReservationsModule,
    VisitorsModule,
    PaymentsModule,
    OccurrencesModule,
    BulletinModule,
    DashboardModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
