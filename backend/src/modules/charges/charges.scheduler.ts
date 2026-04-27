import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  QUEUE_BALANCE_CHECK,
  QUEUE_CHARGES_GENERATION,
  QUEUE_OVERDUE_CHECK,
  QUEUE_POLLS_AUTOCLOSE,
} from '../../queues/queue-names';

@Injectable()
export class ChargesSchedulerService {
  private readonly logger = new Logger(ChargesSchedulerService.name);

  constructor(
    @InjectQueue(QUEUE_CHARGES_GENERATION)
    private readonly chargesGenerationQueue: Queue,
    @InjectQueue(QUEUE_OVERDUE_CHECK)
    private readonly overdueCheckQueue: Queue,
    @InjectQueue(QUEUE_BALANCE_CHECK)
    private readonly balanceCheckQueue: Queue,
    @InjectQueue(QUEUE_POLLS_AUTOCLOSE)
    private readonly pollsAutoCloseQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async dailyGeneration(): Promise<void> {
    this.logger.log('Enfileirando geração diária de cobranças');
    const today = new Date().toISOString().slice(0, 10);
    await this.chargesGenerationQueue.add(
      'run',
      {},
      { jobId: `charges-gen:${today}` },
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyOverdue(): Promise<void> {
    this.logger.log('Enfileirando verificação de cobranças em atraso');
    const today = new Date().toISOString().slice(0, 10);
    await this.overdueCheckQueue.add('run', {}, { jobId: `overdue:${today}` });
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async dailyBalanceCheck(): Promise<void> {
    this.logger.log('Enfileirando verificação de saldo (RN-03.4)');
    const today = new Date().toISOString().slice(0, 10);
    await this.balanceCheckQueue.add('run', {}, { jobId: `balance:${today}` });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async hourlyPollAutoClose(): Promise<void> {
    this.logger.log('Enfileirando auto-close de enquetes vencidas');
    const stamp = new Date().toISOString().slice(0, 13);
    await this.pollsAutoCloseQueue.add(
      'run',
      {},
      { jobId: `poll-close:${stamp}` },
    );
  }
}
