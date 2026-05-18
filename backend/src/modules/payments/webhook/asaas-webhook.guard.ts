import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentAccount } from '../../../database/entities/payment-account.entity';
import { PaymentAccountsRepository } from '../accounts/payment-accounts.repository';

/**
 * Resolve a subconta a partir do `asaas-access-token` header e injeta o
 * `PaymentAccount` no request (`req.paymentAccount`). Token inválido →
 * 401 sem corpo (RN-PG-05.2: não revelar se a subconta existe).
 *
 * Asaas envia esse header em todo callback configurado com `authToken`
 * — geramos um por subconta na criação (`asaas_webhook_token`).
 */
@Injectable()
export class AsaasWebhookGuard implements CanActivate {
  constructor(
    private readonly paymentAccounts: PaymentAccountsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { paymentAccount?: PaymentAccount }
    >();
    const token = req.headers['asaas-access-token'];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException();
    }
    const account = await this.paymentAccounts.findByWebhookToken(token);
    if (!account) {
      throw new UnauthorizedException();
    }
    req.paymentAccount = account;
    return true;
  }
}
