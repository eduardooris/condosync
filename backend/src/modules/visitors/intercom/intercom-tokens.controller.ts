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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ApiStandardResponses } from '../../../common/decorators/api-standard-responses.decorator';
import { UserRole } from '../../../common/enums';
import { CondominiumMemberGuard } from '../../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import {
  CreateIntercomAccessTokenDto,
  IntercomAccessTokenDetailDto,
  IntercomAccessTokenListItemDto,
  IntercomAccessTokenResponseDto,
  IntercomSessionHistoryItemDto,
} from './dto/intercom.dto';
import { IntercomService } from './intercom.service';

@ApiTags('intercom')
@ApiBearerAuth('bearer')
@ApiStandardResponses({ notFound: true })
@Controller('condominiums/:condominiumId/intercom')
@UseGuards(CondominiumMemberGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
export class IntercomTokensController {
  constructor(private readonly intercom: IntercomService) {}

  @Post('tokens')
  @ApiOperation({ summary: 'Gera token/URL da portaria virtual' })
  @ApiCreatedResponse({ type: IntercomAccessTokenResponseDto })
  createToken(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateIntercomAccessTokenDto,
  ) {
    return this.intercom.createAccessToken(condominiumId, user.id, dto);
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Lista tokens de portaria do condomínio' })
  @ApiOkResponse({ type: IntercomAccessTokenListItemDto, isArray: true })
  listTokens(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.intercom.listAccessTokens(condominiumId, user.id);
  }

  @Get('tokens/:tokenId')
  @ApiOperation({ summary: 'Detalhe do token (link e QR da portaria)' })
  @ApiOkResponse({ type: IntercomAccessTokenDetailDto })
  getToken(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.intercom.getAccessTokenDetail(condominiumId, user.id, tokenId);
  }

  @Delete('tokens/:tokenId')
  @ApiOperation({ summary: 'Revoga token de portaria' })
  revokeToken(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.intercom.revokeAccessToken(condominiumId, user.id, tokenId);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Histórico de chamadas da portaria' })
  @ApiOkResponse({ type: IntercomSessionHistoryItemDto, isArray: true })
  listSessions(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.intercom.listSessionHistory(condominiumId, user.id);
  }
}
