import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntercomService } from './intercom.service';

@Injectable()
export class IntercomScheduler {
  private readonly logger = new Logger(IntercomScheduler.name);

  constructor(private readonly intercom: IntercomService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async expireRingingSessions(): Promise<void> {
    const count = await this.intercom.expireStaleSessions();
    if (count > 0) {
      this.logger.log(`Sessões de interfone expiradas: ${count}`);
    }
  }
}
