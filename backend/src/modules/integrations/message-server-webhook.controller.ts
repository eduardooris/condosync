import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MessageServerWebhookService } from './message-server-webhook.service';

@ApiExcludeController()
@Controller('integrations/message-server')
export class MessageServerWebhookController {
  constructor(private readonly service: MessageServerWebhookService) {}

  @Post('qr/refresh')
  @HttpCode(202)
  @SkipThrottle({ default: true, auth: true })
  @Public()
  async refreshQRCode(): Promise<{
    status: 'created' | 'reconnected';
    instanceId?: string;
  }> {
    return this.service.ensureInstanceAndTriggerQR();
  }

  @Get('qr/latest')
  @SkipThrottle({ default: true, auth: true })
  @Public()
  async latestQRCode(): Promise<{
    code: string;
    createdAt: Date;
    expiresAt?: string;
    instanceId?: string;
  }> {
    return this.service.getLatestQRCode();
  }

  @Get('qr/latest/image-url')
  @SkipThrottle({ default: true, auth: true })
  @Public()
  async latestQRCodeImageUrl(): Promise<{
    imageUrl: string;
    createdAt: Date;
    expiresAt?: string;
    instanceId?: string;
  }> {
    return this.service.getLatestQRCodeImageUrl();
  }

  /**
   * Endpoint conveniente: devolve um QR pronto para escanear. Se não
   * houver QR válido no histórico, dispara reconexão e aguarda o novo
   * QR chegar pelo webhook (poll curto). Quando a instância já estiver
   * pareada, devolve `status: 'connected'` em vez de erro.
   */
  @Get('qr/current')
  @SkipThrottle({ default: true, auth: true })
  @Public()
  async currentQRCode(): Promise<{
    status: 'ready' | 'connected';
    imageUrl?: string;
    code?: string;
    createdAt?: Date;
    expiresAt?: string;
    instanceId?: string;
  }> {
    return this.service.getCurrentQR();
  }

  @Post('events')
  @HttpCode(202)
  @SkipThrottle({ default: true, auth: true })
  @Public()
  async receive(
    @Body()
    body: {
      event_id: string;
      event_type: string;
      tenant_id?: string;
      payload: Record<string, unknown>;
    },
    @Headers('x-signature') signature: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ status: 'accepted' | 'duplicate' }> {
    const raw = JSON.stringify(req.body ?? {});
    this.service.verifyBearer(authorization);
    this.service.verifySignature(raw, signature);
    const result = await this.service.ingest(body);
    return { status: result.duplicated ? 'duplicate' : 'accepted' };
  }
}
