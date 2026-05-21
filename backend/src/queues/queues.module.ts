import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import {
  QUEUE_ASAAS_WEBHOOK,
  QUEUE_BALANCE_CHECK,
  QUEUE_BULLETIN_NOTIFY,
  QUEUE_CHARGES_GENERATION,
  QUEUE_INAPP_NOTIFY,
  QUEUE_OCCURRENCE_NOTIFY,
  QUEUE_OVERDUE_CHECK,
  QUEUE_POLLS_AUTOCLOSE,
  QUEUE_WHATSAPP_SEND,
} from './queue-names';
import { WhatsappProcessor } from './whatsapp.processor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Charge } from '../database/entities/charge.entity';
import { Poll } from '../database/entities/poll.entity';
import { Resident } from '../database/entities/resident.entity';
import { User } from '../database/entities/user.entity';
import { UserCondominium } from '../database/entities/user-condominium.entity';
import { MessageServerAdapter } from '../adapters/whatsapp/message-server.adapter';
import { WHATSAPP_ADAPTER } from '../adapters/whatsapp/whatsapp.adapter';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: QUEUE_WHATSAPP_SEND },
      { name: QUEUE_CHARGES_GENERATION },
      { name: QUEUE_OVERDUE_CHECK },
      { name: QUEUE_OCCURRENCE_NOTIFY },
      { name: QUEUE_BULLETIN_NOTIFY },
      { name: QUEUE_BALANCE_CHECK },
      { name: QUEUE_POLLS_AUTOCLOSE },
      { name: QUEUE_INAPP_NOTIFY },
      { name: QUEUE_ASAAS_WEBHOOK },
    ),
    TypeOrmModule.forFeature([Charge, Resident, Poll, User, UserCondominium]),
  ],
  providers: [
    WhatsappProcessor,
    { provide: WHATSAPP_ADAPTER, useClass: MessageServerAdapter },
  ],
  exports: [BullModule, WHATSAPP_ADAPTER],
})
export class QueuesModule {}
