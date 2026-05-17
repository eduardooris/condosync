import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceRegistration } from '../../../database/entities/device-registration.entity';
import { IntercomAccessToken } from '../../../database/entities/intercom-access-token.entity';
import { IntercomSessionEvent } from '../../../database/entities/intercom-session-event.entity';
import { IntercomSession } from '../../../database/entities/intercom-session.entity';
import { Resident } from '../../../database/entities/resident.entity';
import { Unit } from '../../../database/entities/unit.entity';
import { VisitorEntry } from '../../../database/entities/visitor-entry.entity';
import { IntercomConfigController } from './intercom-config.controller';
import { IntercomDevicesController } from './intercom-devices.controller';
import { IntercomGuestJwtService } from './intercom-guest-jwt.service';
import { IntercomPublicController } from './intercom-public.controller';
import { IntercomPublicThrottlerGuard } from './intercom-public-throttler.guard';
import { IntercomScheduler } from './intercom.scheduler';
import { IntercomSessionsController } from './intercom-sessions.controller';
import { IntercomTokensController } from './intercom-tokens.controller';
import { IntercomGateway } from './intercom.gateway';
import { IntercomService } from './intercom.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntercomAccessToken,
      IntercomSession,
      IntercomSessionEvent,
      DeviceRegistration,
      Unit,
      Resident,
      VisitorEntry,
    ]),
  ],
  controllers: [
    IntercomPublicController,
    IntercomSessionsController,
    IntercomTokensController,
    IntercomDevicesController,
    IntercomConfigController,
  ],
  providers: [
    IntercomService,
    IntercomGateway,
    IntercomGuestJwtService,
    IntercomScheduler,
    IntercomPublicThrottlerGuard,
  ],
  exports: [IntercomService],
})
export class IntercomModule {}
