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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { ResidentsService } from './residents.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import {
  NeighborResidentResponseDto,
  ResidentResponseDto,
} from './dto/resident-response.dto';
import {
  MyResidentProfileResponseDto,
  UpdateMyResidentProfileDto,
} from './dto/my-resident-profile.dto';

@ApiBearerAuth('bearer')
@ApiTags('residents')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Sem acesso ao condomínio ou papel insuficiente.',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/units/:unitId/residents')
@UseGuards(CondominiumMemberGuard)
export class ResidentsController {
  constructor(private readonly service: ResidentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Cadastra morador em uma unidade' })
  @ApiCreatedResponse({
    description: 'Morador criado com sucesso.',
    type: ResidentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'CPF/Telefone inválido ou já existe outro responsável.',
    type: ErrorResponseDto,
  })
  create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: CreateResidentDto,
  ) {
    return this.service.create(condominiumId, unitId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({
    summary: 'Lista moradores da unidade (admin)',
    description:
      'RN-02.1 — endpoint expõe PII (CPF, e-mail, WhatsApp) e por isso é restrito a síndico/subsíndico.',
  })
  @ApiOkResponse({
    description: 'Moradores retornados com sucesso.',
    type: ResidentResponseDto,
    isArray: true,
  })
  list(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
  ) {
    return this.service.list(condominiumId, unitId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Atualiza dados de morador' })
  @ApiOkResponse({
    description: 'Morador atualizado com sucesso.',
    type: ResidentResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Morador não encontrado nessa unidade.',
    type: ErrorResponseDto,
  })
  update(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
  ) {
    return this.service.update(condominiumId, unitId, id, dto);
  }

  @Post(':id/set-responsible')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Define morador como responsável financeiro' })
  @ApiOkResponse({
    description: 'Responsável financeiro atualizado.',
    type: ResidentResponseDto,
  })
  setResponsible(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.setResponsible(condominiumId, unitId, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Remove morador da unidade' })
  @ApiOkResponse({
    description: 'Morador removido com sucesso.',
  })
  async remove(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.remove(condominiumId, unitId, id);
    return { ok: true };
  }
}

/**
 * Endpoint sem PII para todos os membros do condomínio (RN-02.1).
 * Permite que o morador conheça os "vizinhos" sem expor CPF/telefone.
 */
@ApiBearerAuth('bearer')
@ApiTags('residents')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Sem acesso ao condomínio.',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/neighbors')
@UseGuards(CondominiumMemberGuard)
export class NeighborsController {
  constructor(private readonly service: ResidentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista vizinhos (sem PII)',
    description:
      'Retorna apenas nome e bloco/unidade dos moradores — sem CPF, e-mail ou telefone (RN-02.1).',
  })
  @ApiOkResponse({
    description: 'Vizinhos retornados.',
    type: NeighborResidentResponseDto,
    isArray: true,
  })
  listNeighbors(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.listNeighbors(condominiumId);
  }
}

@ApiBearerAuth('bearer')
@ApiTags('residents')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Sem acesso ao condomínio.',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/residents/me')
@UseGuards(CondominiumMemberGuard)
export class MyResidentProfileController {
  constructor(private readonly service: ResidentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Retorna cadastro do morador da minha unidade',
    description:
      'Disponível para o usuário autenticado no condomínio ativo quando existir vínculo de morador.',
  })
  @ApiOkResponse({
    description: 'Cadastro do morador retornado.',
    type: MyResidentProfileResponseDto,
  })
  getMyProfile(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.getMyProfile(condominiumId, user.id);
  }

  @Patch()
  @ApiOperation({
    summary: 'Atualiza meu cadastro de morador',
    description:
      'Atualiza nome e WhatsApp do vínculo de morador na unidade do condomínio ativo.',
  })
  @ApiOkResponse({
    description: 'Cadastro de morador atualizado.',
    type: MyResidentProfileResponseDto,
  })
  updateMyProfile(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMyResidentProfileDto,
  ) {
    return this.service.updateMyProfile(condominiumId, user.id, dto);
  }
}
