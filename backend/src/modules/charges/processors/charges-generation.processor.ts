import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ChargesService } from '../charges.service';
import { QUEUE_CHARGES_GENERATION } from '../../../queues/queue-names';

@Processor(QUEUE_CHARGES_GENERATION)
export class ChargesGenerationProcessor {
  private readonly logger = new Logger(ChargesGenerationProcessor.name);

  constructor(private readonly chargesService: ChargesService) {}

  @Process('run')
  async handle(_job: Job): Promise<void> {
    this.logger.log('Processing scheduled charge generation');
    await this.chargesService.runScheduledGenerationForToday();
  }
}
