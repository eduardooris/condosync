import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CondominiumsService } from './condominiums.service';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';
import { AddMemberDto } from './dto/add-member.dto';
import {
  CondominiumResponseDto,
  MembershipResponseDto,
  MyCondominiumResponseDto,
} from './dto/condominium-response.dto';
import { ApiProperty } from '@nestjs/swagger';

class PendingMembershipResponseDto {
  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ example: 'Edifício Aurora' })
  condominiumName: string;
}

@ApiTags('condominiums')
@ApiStandardResponses({ conflict: true, unprocessable: true })
@Controller('condominiums')
export class CondominiumsController {
  constructor(private readonly service: CondominiumsService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um condomínio' })
  @ApiCreatedResponse({
    description: 'Condomínio criado com sucesso.',
    type: CondominiumResponseDto,
  })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCondominiumDto) {
    return this.service.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'Lista condomínios do usuário autenticado',
    description:
      'Retorna apenas memberships APPROVED. Cada item inclui `role` e `unitId` para o front fazer gating de UI.',
  })
  @ApiOkResponse({
    description: 'Lista retornada com sucesso.',
    type: MyCondominiumResponseDto,
    isArray: true,
  })
  listMine(@CurrentUser() user: RequestUser) {
    return this.service.listMine(user.id);
  }

  @Get('mine/pending')
  @ApiOperation({
    summary: 'Lista memberships PENDING do usuário (aguardando aprovação)',
  })
  @ApiOkResponse({
    description: 'Lista retornada com sucesso.',
    type: PendingMembershipResponseDto,
    isArray: true,
  })
  listMyPending(@CurrentUser() user: RequestUser) {
    return this.service.listPendingMemberships(user.id);
  }

  @UseGuards(CondominiumMemberGuard)
  @Get(':condominiumId')
  @ApiOperation({ summary: 'Busca condomínio por ID' })
  @ApiOkResponse({
    description: 'Condomínio encontrado.',
    type: CondominiumResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Condomínio não encontrado.' })
  getOne(@Param('condominiumId', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(CondominiumMemberGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @Patch(':condominiumId')
  @ApiOperation({ summary: 'Atualiza dados do condomínio' })
  @ApiOkResponse({
    description: 'Condomínio atualizado com sucesso.',
    type: CondominiumResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Sem permissão para atualizar.' })
  update(
    @Param('condominiumId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCondominiumDto,
  ) {
    return this.service.update(id, dto);
  }

  @UseGuards(CondominiumMemberGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':condominiumId')
  @ApiOperation({
    summary: 'Arquiva condomínio (não remove fisicamente)',
    description:
      'RN-01.3 — apenas o síndico (ADMIN) pode arquivar. Bloqueia se houver unidades ocupadas ou cobranças em aberto.',
  })
  @ApiOkResponse({
    description: 'Condomínio arquivado com sucesso.',
    type: CondominiumResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Sem permissão para arquivar.' })
  archive(@Param('condominiumId', ParseUUIDPipe) id: string) {
    return this.service.archive(id);
  }

  @UseGuards(CondominiumMemberGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':condominiumId/unarchive')
  @ApiOperation({
    summary: 'Desarquiva condomínio',
    description: 'Restabelece um condomínio previamente arquivado.',
  })
  @ApiOkResponse({
    description: 'Condomínio desarquivado com sucesso.',
    type: CondominiumResponseDto,
  })
  unarchive(@Param('condominiumId', ParseUUIDPipe) id: string) {
    return this.service.unarchive(id);
  }

  @UseGuards(CondominiumMemberGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':condominiumId/members')
  @ApiOperation({ summary: 'Adiciona/atualiza membro no condomínio' })
  @ApiCreatedResponse({
    description: 'Membro vinculado ao condomínio.',
    type: MembershipResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Sem permissão para gerenciar membros.',
  })
  addMember(
    @Param('condominiumId', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(id, dto.email, dto.role);
  }
}
