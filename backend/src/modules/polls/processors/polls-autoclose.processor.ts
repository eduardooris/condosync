import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { QUEUE_POLLS_AUTOCLOSE } from '../../../queues/queue-names';
import { PollsService } from '../polls.service';

/**
 * Roda de hora em hora (RN-04) para encerrar enquetes cujo
 * `closesAt` já passou. Idempotente — se nenhuma enquete está
 * vencida, o job termina como noop.
 */
@Processor(QUEUE_POLLS_AUTOCLOSE)
export class PollsAutoCloseProcessor {
  private readonly logger = new Logger(PollsAutoCloseProcessor.name);

  constructor(private readonly pollsService: PollsService) {}

  @Process('run')
  async handle(_job: Job): Promise<void> {
    const { closed } = await this.pollsService.autoCloseExpired();
    if (closed > 0) {
      this.logger.log(`Auto-fechadas ${closed} enquetes vencidas.`);
    }
  }
}
