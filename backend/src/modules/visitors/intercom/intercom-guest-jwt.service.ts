import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Env } from '../../../config/env.schema';

export interface IntercomGuestClaims {
  sub: 'guest';
  sessionId: string;
  role: 'guest';
}

@Injectable()
export class IntercomGuestJwtService {
  private readonly secret: string;
  private readonly ttlSec: number;

  constructor(config: ConfigService<Env, true>) {
    this.secret =
      config.get('INTERCOM_GUEST_JWT_SECRET', { infer: true }) ??
      'dev-intercom-guest-secret';
    this.ttlSec = config.get('INTERCOM_GUEST_JWT_TTL_SEC', { infer: true });
  }

  sign(sessionId: string): string {
    return jwt.sign(
      { sub: 'guest', sessionId, role: 'guest' } satisfies IntercomGuestClaims,
      this.secret,
      { expiresIn: this.ttlSec },
    );
  }

  verify(token: string): IntercomGuestClaims {
    try {
      const payload = jwt.verify(token, this.secret) as IntercomGuestClaims;
      if (payload.role !== 'guest' || !payload.sessionId) {
        throw new UnauthorizedException('Token de visitante inválido.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException(
        'Token de visitante inválido ou expirado.',
      );
    }
  }
}
