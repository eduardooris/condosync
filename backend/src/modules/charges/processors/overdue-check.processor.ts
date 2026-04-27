import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ChargesService } from '../charges.service';
import { QUEUE_OVERDUE_CHECK } from '../../../queues/queue-names';

@Processor(QUEUE_OVERDUE_CHECK)
export class OverdueCheckProcessor {
  private readonly logger = new Logger(OverdueCheckProcessor.name);

  constructor(private readonly chargesService: ChargesService) {}

  @Process('run')
  async handle(_job: Job): Promise<void> {
    this.logger.log('Processing overdue check');
    await this.chargesService.runOverdueAndReminders();
  }
}
