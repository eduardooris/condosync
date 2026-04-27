import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
} from './dto/invitation-request.dto';
import {
  InvitationPreviewDto,
  InvitationResponseDto,
} from './dto/invitation-response.dto';
import { InvitationsService } from './invitations.service';
import { ApiProperty } from '@nestjs/swagger';

class AcceptInvitationResponseDto {
  @ApiProperty({ nullable: true, type: String })
  accessToken: string | null;

  @ApiProperty({ nullable: true, type: String })
  refreshToken: string | null;

  @ApiProperty({
    description:
      'Quando true, o membership entrou como PENDING e precisa ser aprovado por um admin antes do usuário acessar o condomínio.',
  })
  requiresApproval: boolean;
}

/**
 * Endpoints de convite escopados ao condomínio. Protegidos pelo
 * `CondominiumMemberGuard` + `RolesGuard` (ADMIN/SUB_ADMIN).
 */
@ApiTags('invitations')
@ApiBearerAuth('bearer')
@ApiStandardResponses({ conflict: true, unprocessable: true })
@Controller('condominiums/:condominiumId/invitations')
@UseGuards(CondominiumMemberGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
export class CondominiumInvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Cria convite para o condomínio',
    description:
      'A URL completa do convite (com token bruto) é retornada **apenas uma vez** nesta resposta. Salve-a em local seguro — o backend só armazena o hash.',
  })
  @ApiCreatedResponse({
    description: 'Convite criado com sucesso.',
    type: InvitationResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Sem permissão para criar convites.' })
  create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.service.create(condominiumId, user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista convites ATIVOS do condomínio',
    description: 'Não retorna URL/token bruto — apenas metadados.',
  })
  @ApiOkResponse({
    description: 'Lista retornada com sucesso.',
    type: InvitationResponseDto,
    isArray: true,
  })
  list(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.listByCondominium(condominiumId);
  }
}

/**
 * Endpoints PÚBLICOS de convite (sem autenticação). Usados pela página de
 * aceite. Também serve `DELETE` para revogar (autenticado, validação
 * caseira porque a URL não traz `condominiumId`).
 */
@ApiTags('invitations')
@ApiStandardResponses({ conflict: true, unprocessable: true })
@Controller('invitations')
export class InvitationsPublicController {
  constructor(private readonly service: InvitationsService) {}

  @Public()
  @Get(':token')
  @ApiOperation({
    summary: 'Preview público do convite (mostra antes do aceite)',
  })
  @ApiOkResponse({
    description: 'Preview retornado com sucesso.',
    type: InvitationPreviewDto,
  })
  preview(@Param('token') token: string) {
    return this.service.preview(token);
  }

  @Public()
  @Post(':token/accept')
  @ApiOperation({
    summary: 'Aceita convite e cria/vincula usuário ao condomínio',
    description:
      'Para EMAIL_DIRECT: aprovação automática (entra como APPROVED). Para GENERIC_LINK: entra como PENDING (admin precisa aprovar).',
  })
  @ApiOkResponse({
    description: 'Convite aceito com sucesso.',
    type: AcceptInvitationResponseDto,
  })
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
  ): Promise<AcceptInvitationResponseDto> {
    return this.service.accept(token, dto);
  }

  @ApiBearerAuth('bearer')
  @Delete(':invitationId')
  @ApiOperation({ summary: 'Revoga convite (ADMIN/SUB_ADMIN do condomínio)' })
  @ApiOkResponse({ description: 'Convite revogado.' })
  @ApiForbiddenResponse({
    description: 'Sem permissão para revogar este convite.',
  })
  async revoke(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.service.revoke(invitationId, user.id);
    return { ok: true };
  }
}
