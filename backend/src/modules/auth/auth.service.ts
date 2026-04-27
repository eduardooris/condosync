import {
  BadRequestException,
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { AUTH_ADAPTER, IAuthAdapter } from '../../adapters/auth/auth.adapter';
import { KeycloakAdminClient } from '../../adapters/auth/keycloak-admin.client';
import { UsersService } from '../users/users.service';
import {
  WHATSAPP_ADAPTER,
  IWhatsAppAdapter,
} from '../../adapters/whatsapp/whatsapp.adapter';
import { Env } from '../../config/env.schema';
import { Resident } from '../../database/entities/resident.entity';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import {
  formatBrazilWhatsappForSending,
  isValidBrazilWhatsapp,
} from '../../common/utils/br-documents';
import { UpdateMeDto } from './dto/update-me.dto';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_ADAPTER) private readonly authAdapter: IAuthAdapter,
    private readonly usersService: UsersService,
    private readonly keycloakAdmin: KeycloakAdminClient,
    @Inject(WHATSAPP_ADAPTER) private readonly whatsapp: IWhatsAppAdapter,
    @InjectRepository(Resident)
    private readonly residents: Repository<Resident>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string) {
    const session = await this.authAdapter.signInWithPassword(email, password);
    const claims = await this.authAdapter.verifyAccessToken(
      session.accessToken,
    );
    await this.usersService.ensureFromAuth({
      id: claims.sub,
      email: claims.email ?? email,
    });
    return session;
  }

  async logout(accessToken: string): Promise<void> {
    await this.authAdapter.signOut(accessToken);
  }

  async refresh(refreshToken: string) {
    return this.authAdapter.refreshSession(refreshToken);
  }

  async register(params: {
    email: string;
    password: string;
    fullName?: string;
  }) {
    const result = await this.authAdapter.signUp({
      ...params,
      assignCondoAdmin: true,
    });
    await this.usersService.ensureFromAuth({
      id: result.userId,
      email: result.email,
      fullName: params.fullName ?? null,
    });
    return result;
  }

  /**
   * Recebe o e-mail da conta, resolve o usuário local e envia o link de
   * redefinição por WhatsApp (número do morador vinculado ao `user_id`).
   * Resposta uniforme para não revelar existência da conta ou ausência de WhatsApp.
   */
  async forgotPassword(emailRaw: string): Promise<void> {
    const email = emailRaw?.trim() ?? '';
    if (!email) {
      throw new BadRequestException('Informe o e-mail da sua conta.');
    }

    const user = await this.usersService.findByEmailNormalized(email);
    if (!user) {
      this.logger.debug(
        `Solicitação de reset: e-mail não encontrado (normalizado).`,
      );
      return;
    }

    const userWhatsapp = user.phoneWhatsapp?.trim() ?? '';
    let sendTo: string | null = null;
    if (userWhatsapp && isValidBrazilWhatsapp(userWhatsapp)) {
      sendTo = formatBrazilWhatsappForSending(userWhatsapp);
    } else {
      const resident = await this.residents
        .createQueryBuilder('r')
        .where('r.user_id = :userId', { userId: user.id })
        .orderBy('r.updated_at', 'DESC')
        .getOne();

      if (!resident?.phoneWhatsapp?.trim()) {
        this.logger.debug(
          `Solicitação de reset: usuário ${user.id} sem WhatsApp na conta nem em morador.`,
        );
        return;
      }
      sendTo = formatBrazilWhatsappForSending(resident.phoneWhatsapp);
    }

    const userId = user.id;

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.resetTokens
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere('used_at IS NULL')
      .execute();

    const saved = await this.resetTokens.save(
      this.resetTokens.create({
        userId,
        tokenHash,
        expiresAt,
        usedAt: null,
      }),
    );

    const baseUrl = this.config
      .get('APP_PUBLIC_URL', { infer: true })
      .replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(plainToken)}`;

    const message =
      `🔐 *CondoSync*\n\n` +
      `Para criar uma nova senha, abra o link abaixo. Ele expira em 1 hora.\n\n` +
      `${resetUrl}\n\n` +
      `Se você não solicitou, ignore esta mensagem.`;

    try {
      await this.whatsapp.sendMessage(sendTo, message);
    } catch (err) {
      await this.resetTokens.delete({ id: saved.id });
      this.logger.error(
        `Falha ao enviar WhatsApp de reset para userId=${userId}: ${(err as Error).message}`,
      );
      throw new BadGatewayException(
        'Não foi possível enviar o WhatsApp agora. Tente novamente em alguns minutos.',
      );
    }
  }

  async resetPassword(plainToken: string, newPassword: string): Promise<void> {
    const token = plainToken?.trim() ?? '';
    if (token.length < 32) {
      throw new BadRequestException('Link inválido ou expirado.');
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await this.resetTokens.findOne({ where: { tokenHash } });
    if (!row || row.usedAt) {
      throw new BadRequestException('Link inválido ou expirado.');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link inválido ou expirado.');
    }

    await this.keycloakAdmin.setPassword(row.userId, newPassword);
    row.usedAt = new Date();
    await this.resetTokens.save(row);
  }

  async me(userId: string, emailFromToken?: string) {
    const user = await this.usersService.findById(userId);
    if (!user && emailFromToken) {
      return this.usersService.ensureFromAuth({
        id: userId,
        email: emailFromToken,
      });
    }
    if (!user) {
      return null;
    }
    return user;
  }

  async updateMyProfile(userId: string, dto: UpdateMeDto) {
    const patch: { fullName?: string | null; phoneWhatsapp?: string | null } =
      {};
    if (dto.fullName !== undefined) {
      patch.fullName = dto.fullName;
    }
    if (dto.phoneWhatsapp !== undefined) {
      const raw = (dto.phoneWhatsapp ?? '').trim();
      if (raw !== '' && !isValidBrazilWhatsapp(raw)) {
        throw new BadRequestException(
          'Informe um WhatsApp válido (DDD + número, 10 a 13 dígitos com DDI opcional).',
        );
      }
      patch.phoneWhatsapp = raw === '' ? null : raw;
    }
    if (Object.keys(patch).length === 0) {
      const u = await this.usersService.findById(userId);
      if (!u) {
        throw new NotFoundException('Usuário não encontrado.');
      }
      return u;
    }
    return this.usersService.updateProfile(userId, patch);
  }
}
