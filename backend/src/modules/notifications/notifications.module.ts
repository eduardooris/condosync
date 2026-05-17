import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../database/entities/notification.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

/**
 * Módulo global — qualquer outro módulo pode injetar
 * `NotificationsService` para gravar uma notificação in-app
 * (em paralelo ao envio WhatsApp). O `NotificationsGateway` provê
 * delivery real-time via WebSocket (`/notifications` namespace).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification]), AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
