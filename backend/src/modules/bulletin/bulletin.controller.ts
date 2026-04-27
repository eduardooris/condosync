import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CondominiumMembership } from '../../common/decorators/condominium-membership.decorator';
import {
  CondominiumMembershipContext,
  RequestUser,
} from '../../common/interfaces/request-user.interface';
import { BulletinService } from './bulletin.service';
import { CreateBulletinDto } from './dto/create-bulletin.dto';
import { BulletinResponseDto } from './dto/bulletin-response.dto';

@ApiTags('bulletin')
@ApiStandardResponses()
@Controller('condominiums/:condominiumId/bulletin')
@UseGuards(CondominiumMemberGuard)
export class BulletinController {
  constructor(private readonly service: BulletinService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista recados do mural',
    description:
      'Por padrão devolve apenas recados não expirados (US-09). ' +
      'Admins/sub-admins podem usar `?includeExpired=true` para ver o histórico.',
  })
  @ApiQuery({
    name: 'includeExpired',
    required: false,
    type: Boolean,
    description:
      'Quando `true`, inclui recados com `expiresAt` no passado. ' +
      'Apenas administradores podem habilitar.',
  })
  @ApiOkResponse({
    description: 'Recados retornados com sucesso.',
    type: BulletinResponseDto,
    isArray: true,
  })
  list(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CondominiumMembership() membership: CondominiumMembershipContext,
    @Query('includeExpired', new ParseBoolPipe({ optional: true }))
    includeExpired?: boolean,
  ) {
    const isAdmin =
      membership?.role === UserRole.ADMIN ||
      membership?.role === UserRole.SUB_ADMIN;
    return this.service.list(condominiumId, isAdmin && includeExpired === true);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Cria recado no mural' })
  @ApiCreatedResponse({
    description: 'Recado criado com sucesso.',
    type: BulletinResponseDto,
  })
  create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateBulletinDto,
  ) {
    return this.service.create(condominiumId, user.id, dto);
  }
}
