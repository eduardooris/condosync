import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageServerEvent } from '../../database/entities/message-server-event.entity';
import { MessageServerWebhookController } from './message-server-webhook.controller';
import { MessageServerWebhookService } from './message-server-webhook.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessageServerEvent])],
  controllers: [MessageServerWebhookController],
  providers: [MessageServerWebhookService],
})
export class IntegrationsModule {}
