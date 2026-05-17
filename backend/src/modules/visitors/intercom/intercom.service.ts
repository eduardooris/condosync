import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { In, LessThan, Repository } from 'typeorm';
import { Env } from '../../../config/env.schema';
import {
  IntercomRejectPolicy,
  IntercomSessionStatus,
  IntercomSessionUpdateReason,
  UnitStatus,
} from '../../../common/enums';
import { TenantMembershipService } from '../../../common/services/tenant-membership.service';
import { DeviceRegistration } from '../../../database/entities/device-registration.entity';
import { IntercomAccessToken } from '../../../database/entities/intercom-access-token.entity';
import { IntercomSessionEvent } from '../../../database/entities/intercom-session-event.entity';
import { IntercomSession } from '../../../database/entities/intercom-session.entity';
import { Resident } from '../../../database/entities/resident.entity';
import { Unit } from '../../../database/entities/unit.entity';
import {
  VisitorEntry,
  VisitorEntryStatus,
  VisitorEntryType,
} from '../../../database/entities/visitor-entry.entity';
import {
  CreateIntercomAccessTokenDto,
  CreateIntercomSessionDto,
  CreateIntercomSessionResponseDto,
  IceServerDto,
  IntercomAccessTokenListItemDto,
  IntercomAccessTokenResponseDto,
  IntercomSessionHistoryItemDto,
  IntercomSessionStatusDto,
  PortariaUnitDto,
  RegisterDeviceDto,
  RegisterDeviceResponseDto,
} from './dto/intercom.dto';
import { IntercomGateway } from './intercom.gateway';
import { IntercomGuestJwtService } from './intercom-guest-jwt.service';
import {
  assertIntercomTransition,
  INTERCOM_RINGING_STATUSES,
  isIntercomTerminal,
} from './intercom-session.machine';
import {
  formatUnitLabel,
  generateIntercomToken,
  hashIntercomToken,
  timingSafeTokenMatch,
} from './intercom-token.util';

const IDEMPOTENCY_WINDOW_MS = 30_000;

@Injectable()
export class IntercomService {
  private readonly appPublicUrl: string;
  private readonly apiPublicUrl: string;
  private readonly ringTimeoutSec: number;
  private readonly rejectPolicy: IntercomRejectPolicy;
  private readonly stunUrls: string;
  private readonly turnUrl?: string;
  private readonly turnUsername?: string;
  private readonly turnCredential?: string;

  constructor(
    @InjectRepository(IntercomAccessToken)
    private readonly tokenRepo: Repository<IntercomAccessToken>,
    @InjectRepository(IntercomSession)
    private readonly sessionRepo: Repository<IntercomSession>,
    @InjectRepository(IntercomSessionEvent)
    private readonly eventRepo: Repository<IntercomSessionEvent>,
    @InjectRepository(DeviceRegistration)
    private readonly deviceRepo: Repository<DeviceRegistration>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(VisitorEntry)
    private readonly visitorEntryRepo: Repository<VisitorEntry>,
    private readonly tenantMembership: TenantMembershipService,
    private readonly guestJwt: IntercomGuestJwtService,
    private readonly gateway: IntercomGateway,
    @InjectPinoLogger(IntercomService.name)
    private readonly logger: PinoLogger,
    config: ConfigService<Env, true>,
  ) {
    this.appPublicUrl = (
      config.get('APP_PUBLIC_URL', { infer: true }) ?? ''
    ).replace(/\/$/, '');
    this.apiPublicUrl = (
      config.get('API_PUBLIC_URL', { infer: true }) ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    this.ringTimeoutSec = config.get('INTERCOM_RING_TIMEOUT_SEC', {
      infer: true,
    });
    this.rejectPolicy = config.get('INTERCOM_REJECT_POLICY', {
      infer: true,
    }) as IntercomRejectPolicy;
    this.stunUrls = config.get('WEBRTC_STUN_URLS', { infer: true });
    this.turnUrl = config.get('WEBRTC_TURN_URL', { infer: true });
    this.turnUsername = config.get('WEBRTC_TURN_USERNAME', { infer: true });
    this.turnCredential = config.get('WEBRTC_TURN_CREDENTIAL', {
      infer: true,
    });
  }

  private configStunUrls(): string {
    return this.stunUrls;
  }

  getWsUrl(): string {
    return `${this.apiPublicUrl}/intercom`;
  }

  getIceServers(): IceServerDto[] {
    const stunRaw = this.configStunUrls();
    const servers: IceServerDto[] = stunRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ urls: url }));

    const turnUrl = this.turnUrl?.trim();
    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: this.turnUsername,
        credential: this.turnCredential,
      });
    }
    return servers;
  }

  async listPublicUnits(rawToken: string): Promise<PortariaUnitDto[]> {
    const access = await this.resolveAccessToken(rawToken);
    const units = await this.unitRepo.find({
      where: {
        condominiumId: access.condominiumId,
        status: UnitStatus.OCCUPIED,
      },
      order: { block: 'ASC', number: 'ASC' },
    });
    return units.map((u) => ({
      id: u.id,
      block: u.block,
      number: u.number,
      label: formatUnitLabel(u.block, u.number),
    }));
  }

  async createSession(
    rawToken: string,
    dto: CreateIntercomSessionDto,
  ): Promise<CreateIntercomSessionResponseDto> {
    const access = await this.resolveAccessToken(rawToken);
    const visitorName = dto.visitorName.trim();
    const unit = await this.unitRepo.findOne({
      where: {
        id: dto.unitId,
        condominiumId: access.condominiumId,
        status: UnitStatus.OCCUPIED,
      },
    });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada.');
    }

    const existing = await this.findIdempotentSession(
      access.id,
      dto.unitId,
      visitorName,
    );
    if (existing) {
      return this.buildSessionResponse(existing);
    }

    const ringExpiresAt = new Date(Date.now() + this.ringTimeoutSec * 1000);
    let session = this.sessionRepo.create({
      condominiumId: access.condominiumId,
      unitId: unit.id,
      accessTokenId: access.id,
      visitorName,
      status: IntercomSessionStatus.INITIATED,
      ringExpiresAt,
    });
    session = await this.sessionRepo.save(session);
    await this.logEvent(session.id, 'session_created', { unitId: unit.id });

    assertIntercomTransition(session.status, IntercomSessionStatus.RINGING);
    session.status = IntercomSessionStatus.RINGING;
    session = await this.sessionRepo.save(session);
    await this.logEvent(session.id, 'ring_started', {});

    const unitLabel = formatUnitLabel(unit.block, unit.number);
    await this.dispatchRing(session, unitLabel);

    this.logger.info(
      {
        condominium_id: session.condominiumId,
        session_id: session.id,
        unit_id: session.unitId,
        access_token_id: access.id,
        ring_expires_at: ringExpiresAt.toISOString(),
      },
      'intercom.session.created',
    );

    return this.buildSessionResponse(session);
  }

  async getPublicSessionStatus(
    sessionId: string,
  ): Promise<IntercomSessionStatusDto> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Sessão não encontrada.');
    }
    await this.expireSessionIfNeeded(session);
    return this.toStatusDto(session);
  }

  async cancelByVisitor(
    sessionId: string,
    guestWsToken: string,
  ): Promise<IntercomSessionStatusDto> {
    const claims = this.guestJwt.verify(guestWsToken);
    if (claims.sessionId !== sessionId) {
      throw new NotFoundException('Sessão não encontrada.');
    }
    const session = await this.loadSessionOrFail(sessionId);
    if (isIntercomTerminal(session.status)) {
      return this.toStatusDto(session);
    }
    return this.transitionSession(
      session,
      IntercomSessionStatus.CANCELED_BY_VISITOR,
      IntercomSessionUpdateReason.VISITOR_LEFT,
    );
  }

  async accept(
    userId: string,
    sessionId: string,
  ): Promise<IntercomSessionStatusDto> {
    const session = await this.loadSessionOrFail(sessionId);
    await this.expireSessionIfNeeded(session);
    const refreshed = await this.loadSessionOrFail(sessionId);

    if (refreshed.status === IntercomSessionStatus.ANSWERED) {
      const answered = await this.residentRepo.findOne({
        where: { id: refreshed.answeredByResidentId ?? '' },
      });
      if (answered?.userId === userId) {
        return this.toStatusDto(refreshed);
      }
      throw new ConflictException('Chamada já atendida por outro morador.');
    }
    if (!INTERCOM_RINGING_STATUSES.includes(refreshed.status)) {
      throw new ConflictException(
        'Esta chamada não está mais disponível para atendimento.',
      );
    }

    const resident = await this.tenantMembership.findResidentOnOwnedUnit(
      userId,
      refreshed.condominiumId,
      refreshed.unitId,
    );

    const entry = await this.visitorEntryRepo.save(
      this.visitorEntryRepo.create({
        condominiumId: refreshed.condominiumId,
        unitId: refreshed.unitId,
        residentId: resident.id,
        visitorName: refreshed.visitorName,
        expectedAt: new Date(),
        status: VisitorEntryStatus.ARRIVED,
        type: VisitorEntryType.VISITA,
      }),
    );

    const updateResult = await this.sessionRepo.update(
      {
        id: sessionId,
        status: In([
          IntercomSessionStatus.INITIATED,
          IntercomSessionStatus.RINGING,
          IntercomSessionStatus.PREVIEW,
        ]),
      },
      {
        status: IntercomSessionStatus.ANSWERED,
        answeredByResidentId: resident.id,
        visitorEntryId: entry.id,
      },
    );

    if (!updateResult.affected) {
      const current = await this.loadSessionOrFail(sessionId);
      if (current.status === IntercomSessionStatus.ANSWERED) {
        throw new ConflictException('Chamada já atendida por outro morador.');
      }
      throw new ConflictException(
        'Esta chamada não está mais disponível para atendimento.',
      );
    }

    const updated = await this.loadSessionOrFail(sessionId);
    await this.logEvent(updated.id, 'accepted', { residentId: resident.id });
    this.logger.info(
      {
        condominium_id: updated.condominiumId,
        session_id: updated.id,
        unit_id: updated.unitId,
        from_status: refreshed.status,
        to_status: IntercomSessionStatus.ANSWERED,
        resident_id: resident.id,
        user_id: userId,
      },
      'intercom.session.accepted',
    );

    this.gateway.emitSessionUpdate(updated);
    const others = await this.residentUserIdsForUnit(updated.unitId, userId);
    if (others.length) {
      this.gateway.emitSessionUpdate(
        updated,
        IntercomSessionUpdateReason.ANSWERED_BY_OTHER,
        others,
      );
    }

    return this.toStatusDto(updated);
  }

  async reject(
    userId: string,
    sessionId: string,
  ): Promise<IntercomSessionStatusDto> {
    const session = await this.loadSessionOrFail(sessionId);
    await this.tenantMembership.findResidentOnOwnedUnit(
      userId,
      session.condominiumId,
      session.unitId,
    );
    if (isIntercomTerminal(session.status)) {
      return this.toStatusDto(session);
    }

    await this.logEvent(session.id, 'rejected', { userId });
    this.logger.info(
      {
        condominium_id: session.condominiumId,
        session_id: session.id,
        unit_id: session.unitId,
        user_id: userId,
        reject_policy: this.rejectPolicy,
      },
      'intercom.session.rejected',
    );

    if (this.rejectPolicy !== IntercomRejectPolicy.ALL_REJECTED) {
      // Policy `continue_ringing` (default): sessão segue em RINGING até
      // alguém aceitar ou estourar o timeout. Outros moradores ainda podem
      // atender, conforme RN-BE-10.5.
      return this.toStatusDto(session);
    }

    // Policy `all_rejected`: contar usuários distintos que rejeitaram e
    // comparar com o conjunto de moradores elegíveis. Se todos recusaram,
    // transicionar a sessão para REJECTED com razão ALL_REJECTED.
    const eligibleUserIds = await this.residentUserIdsForUnit(session.unitId);
    if (eligibleUserIds.length === 0) {
      return this.toStatusDto(session);
    }

    const rejectedUserIds = await this.distinctRejectedUserIds(session.id);
    const allRejected = eligibleUserIds.every((id) => rejectedUserIds.has(id));
    if (!allRejected) {
      return this.toStatusDto(session);
    }

    return this.transitionSession(
      session,
      IntercomSessionStatus.REJECTED,
      IntercomSessionUpdateReason.ALL_REJECTED,
    );
  }

  private async distinctRejectedUserIds(
    sessionId: string,
  ): Promise<Set<string>> {
    const events = await this.eventRepo.find({
      where: { sessionId, event: 'rejected' },
    });
    const ids = new Set<string>();
    for (const ev of events) {
      const payload = (ev.payloadJson ?? {}) as { userId?: unknown };
      if (typeof payload.userId === 'string' && payload.userId.length > 0) {
        ids.add(payload.userId);
      }
    }
    return ids;
  }

  async endSession(
    userId: string | null,
    sessionId: string,
    guestWsToken?: string,
  ): Promise<IntercomSessionStatusDto> {
    const session = await this.loadSessionOrFail(sessionId);

    if (guestWsToken) {
      const claims = this.guestJwt.verify(guestWsToken);
      if (claims.sessionId !== sessionId) {
        throw new NotFoundException('Sessão não encontrada.');
      }
    } else if (userId) {
      await this.tenantMembership.assertUserOwnsUnit(
        userId,
        session.condominiumId,
        session.unitId,
      );
    } else {
      throw new NotFoundException('Sessão não encontrada.');
    }

    if (isIntercomTerminal(session.status)) {
      return this.toStatusDto(session);
    }

    return this.transitionSession(
      session,
      IntercomSessionStatus.ENDED,
      IntercomSessionUpdateReason.ENDED,
    );
  }

  async createAccessToken(
    condominiumId: string,
    userId: string,
    dto: CreateIntercomAccessTokenDto,
  ): Promise<IntercomAccessTokenResponseDto> {
    await this.tenantMembership.assertAdminOrSub(userId, condominiumId);
    const raw = generateIntercomToken();
    const row = await this.tokenRepo.save(
      this.tokenRepo.create({
        condominiumId,
        tokenHash: hashIntercomToken(raw),
        label: dto.label?.trim() || null,
        createdByUserId: userId,
      }),
    );
    return {
      id: row.id,
      accessToken: raw,
      portariaUrl: `${this.appPublicUrl}/portaria/${raw}`,
      label: row.label,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    };
  }

  async listAccessTokens(
    condominiumId: string,
    userId: string,
  ): Promise<IntercomAccessTokenListItemDto[]> {
    await this.tenantMembership.assertAdminOrSub(userId, condominiumId);
    const rows = await this.tokenRepo.find({
      where: { condominiumId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      createdAt: r.createdAt,
      revokedAt: r.revokedAt,
      portariaPathHint: '/portaria/<token-na-criacao>',
    }));
  }

  async revokeAccessToken(
    condominiumId: string,
    userId: string,
    tokenId: string,
  ): Promise<void> {
    await this.tenantMembership.assertAdminOrSub(userId, condominiumId);
    const row = await this.tokenRepo.findOne({
      where: { id: tokenId, condominiumId },
    });
    if (!row) {
      throw new NotFoundException('Token de portaria não encontrado.');
    }
    row.revokedAt = new Date();
    await this.tokenRepo.save(row);
  }

  async listSessionHistory(
    condominiumId: string,
    userId: string,
  ): Promise<IntercomSessionHistoryItemDto[]> {
    await this.tenantMembership.assertAdminOrSub(userId, condominiumId);
    const sessions = await this.sessionRepo.find({
      where: { condominiumId },
      relations: ['unit', 'answeredByResident'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return sessions.map((s) => ({
      id: s.id,
      visitorName: s.visitorName,
      unitId: s.unitId,
      unitLabel: s.unit ? formatUnitLabel(s.unit.block, s.unit.number) : '—',
      status: s.status,
      answeredByName: s.answeredByResident?.fullName ?? null,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
    }));
  }

  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<RegisterDeviceResponseDto> {
    const residentId = dto.residentId ?? null;
    if (residentId) {
      const resident = await this.residentRepo.findOne({
        where: { id: residentId, userId },
      });
      if (!resident) {
        throw new NotFoundException('Morador não encontrado.');
      }
    }

    const existing = await this.deviceRepo.findOne({
      where: { userId, deviceId: dto.deviceId },
    });
    const row =
      existing ??
      this.deviceRepo.create({
        userId,
        deviceId: dto.deviceId,
        platform: dto.platform,
      });
    row.platform = dto.platform;
    row.pushToken = dto.pushToken?.trim() || null;
    row.residentId = residentId;
    row.lastSeenAt = new Date();
    const saved = await this.deviceRepo.save(row);
    return {
      id: saved.id,
      deviceId: saved.deviceId,
      platform: saved.platform,
    };
  }

  async expireStaleSessions(): Promise<number> {
    const now = new Date();
    const stale = await this.sessionRepo.find({
      where: {
        status: In([
          IntercomSessionStatus.RINGING,
          IntercomSessionStatus.PREVIEW,
          IntercomSessionStatus.INITIATED,
        ]),
        ringExpiresAt: LessThan(now),
      },
    });
    for (const session of stale) {
      await this.transitionSession(
        session,
        IntercomSessionStatus.MISSED,
        IntercomSessionUpdateReason.TIMEOUT,
      );
    }
    return stale.length;
  }

  async resolveAccessToken(raw: string): Promise<IntercomAccessToken> {
    const hash = hashIntercomToken(raw);
    const row = await this.tokenRepo.findOne({
      where: { tokenHash: hash },
    });
    if (!row || row.revokedAt) {
      throw new NotFoundException('Link de portaria inválido ou expirado.');
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      throw new NotFoundException('Link de portaria inválido ou expirado.');
    }
    if (!timingSafeTokenMatch(raw, row.tokenHash)) {
      throw new NotFoundException('Link de portaria inválido ou expirado.');
    }
    return row;
  }

  private async findIdempotentSession(
    accessTokenId: string,
    unitId: string,
    visitorName: string,
  ): Promise<IntercomSession | null> {
    const since = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS);
    return this.sessionRepo
      .createQueryBuilder('s')
      .where('s.access_token_id = :accessTokenId', { accessTokenId })
      .andWhere('s.unit_id = :unitId', { unitId })
      .andWhere('s.visitor_name = :visitorName', { visitorName })
      .andWhere('s.status IN (:...statuses)', {
        statuses: [
          IntercomSessionStatus.INITIATED,
          IntercomSessionStatus.RINGING,
          IntercomSessionStatus.PREVIEW,
        ],
      })
      .andWhere('s.created_at >= :since', { since })
      .orderBy('s.created_at', 'DESC')
      .getOne();
  }

  private buildSessionResponse(
    session: IntercomSession,
  ): CreateIntercomSessionResponseDto {
    return {
      sessionId: session.id,
      guestWsToken: this.guestJwt.sign(session.id),
      wsUrl: this.getWsUrl(),
      iceServers: this.getIceServers(),
      ringExpiresAt: session.ringExpiresAt!,
      status: session.status,
    };
  }

  private async loadSessionOrFail(sessionId: string): Promise<IntercomSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['answeredByResident'],
    });
    if (!session) {
      throw new NotFoundException('Sessão não encontrada.');
    }
    return session;
  }

  private async expireSessionIfNeeded(session: IntercomSession): Promise<void> {
    if (
      !session.ringExpiresAt ||
      isIntercomTerminal(session.status) ||
      !INTERCOM_RINGING_STATUSES.includes(session.status)
    ) {
      return;
    }
    if (session.ringExpiresAt < new Date()) {
      await this.transitionSession(
        session,
        IntercomSessionStatus.MISSED,
        IntercomSessionUpdateReason.TIMEOUT,
      );
    }
  }

  private async transitionSession(
    session: IntercomSession,
    to: IntercomSessionStatus,
    reason?: IntercomSessionUpdateReason,
  ): Promise<IntercomSessionStatusDto> {
    const from = session.status;
    assertIntercomTransition(from, to);
    session.status = to;
    if (isIntercomTerminal(to)) {
      session.endedAt = new Date();
    }
    const saved = await this.sessionRepo.save(session);
    await this.logEvent(saved.id, `status_${to}`, { reason });
    this.logger.info(
      {
        condominium_id: saved.condominiumId,
        session_id: saved.id,
        unit_id: saved.unitId,
        from_status: from,
        to_status: to,
        reason: reason ?? null,
      },
      'intercom.session.transition',
    );
    this.gateway.emitSessionUpdate(saved, reason);
    return this.toStatusDto(saved);
  }

  private async dispatchRing(
    session: IntercomSession,
    unitLabel: string,
  ): Promise<void> {
    const userIds = await this.residentUserIdsForUnit(session.unitId);
    this.gateway.emitRing({
      sessionId: session.id,
      unitId: session.unitId,
      unitLabel,
      visitorName: session.visitorName,
      condominiumId: session.condominiumId,
      targetUserIds: userIds,
    });
  }

  private async residentUserIdsForUnit(
    unitId: string,
    excludeUserId?: string,
  ): Promise<string[]> {
    const residents = await this.residentRepo.find({
      where: { unitId },
    });
    const ids = residents
      .map((r) => r.userId)
      .filter((id): id is string => Boolean(id));
    const unique = [...new Set(ids)];
    if (excludeUserId) {
      return unique.filter((id) => id !== excludeUserId);
    }
    return unique;
  }

  private async logEvent(
    sessionId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.eventRepo.save(
      this.eventRepo.create({
        sessionId,
        event,
        payloadJson: payload,
      }),
    );
  }

  private toStatusDto(session: IntercomSession): IntercomSessionStatusDto {
    return {
      sessionId: session.id,
      status: session.status,
      endedAt: session.endedAt,
    };
  }
}
