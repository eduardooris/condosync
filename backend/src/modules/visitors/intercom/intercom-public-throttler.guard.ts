import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler do endpoint público de criação de sessão de portaria.
 *
 * Sobrescreve `getTracker` para gerar a chave de rate-limit a partir
 * de `(ip, accessToken)` em vez do IP isolado, atendendo a RN-10.10
 * do documento `docs/05_portaria_virtual_intercom.md`:
 *
 * > "Rate limit por IP e por accessToken (ex.: máximo 10 sessões
 * > iniciadas por token em 5 minutos)."
 *
 * Aplicado especificamente na rota `POST /portaria/:accessToken/sessions`
 * através do throttler nomeado `intercom-sessions` configurado no
 * `AppModule`.
 */
@Injectable()
export class IntercomPublicThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const params = (req.params ?? {}) as Record<string, unknown>;
    const accessToken =
      typeof params.accessToken === 'string' ? params.accessToken : 'unknown';
    const ip =
      typeof req.ip === 'string'
        ? req.ip
        : ((req as { ips?: string[] }).ips?.[0] ?? 'unknown');
    return Promise.resolve(`intercom-public:${ip}:${accessToken}`);
  }
}
