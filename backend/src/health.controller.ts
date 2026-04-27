import { InjectQueue } from '@nestjs/bull';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bull';
import { DataSource } from 'typeorm';
import { Public } from './common/decorators/public.decorator';
import { HealthResponseDto } from './common/dto/health-response.dto';
import { QUEUE_WHATSAPP_SEND } from './queues/queue-names';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(QUEUE_WHATSAPP_SEND) private readonly whatsappQueue: Queue,
  ) {}

  @Public()
  @Get('health/live')
  @ApiOperation({ summary: 'Liveness da API (processo ativo)' })
  @ApiOkResponse({ description: 'API saudável.', type: HealthResponseDto })
  live(): HealthResponseDto {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({
    summary: 'Readiness da API (dependências críticas)',
  })
  @ApiOkResponse({
    description: 'Dependências disponíveis.',
    type: HealthResponseDto,
  })
  async ready(): Promise<HealthResponseDto> {
    const checks: HealthResponseDto['checks'] = {
      database: 'ok',
      redis: 'ok',
    };
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      checks.database = 'unavailable';
    }
    try {
      const client = await (
        this.whatsappQueue as unknown as {
          client: Promise<{ ping: () => Promise<string> }>;
        }
      ).client;
      await client.ping();
    } catch {
      checks.redis = 'unavailable';
    }
    if (checks.database !== 'ok' || checks.redis !== 'ok') {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks,
      });
    }
    return { status: 'ok', checks };
  }

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Healthcheck compatível (atalho para liveness)',
  })
  @ApiOkResponse({ description: 'API saudável.', type: HealthResponseDto })
  health(): HealthResponseDto {
    return this.live();
  }
}
