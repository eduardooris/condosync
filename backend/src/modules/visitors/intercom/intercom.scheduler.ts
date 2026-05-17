import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { IntercomService } from './intercom.service';

@Injectable()
export class IntercomScheduler {
  constructor(
    private readonly intercom: IntercomService,
    @InjectPinoLogger(IntercomScheduler.name)
    private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireRingingSessions(): Promise<void> {
    const count = await this.intercom.expireStaleSessions();
    if (count > 0) {
      this.logger.info(
        { expired_count: count },
        'intercom.scheduler.expired_sessions',
      );
    }
  }
}
