import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { ImportUnitsDto } from './dto/import-units.dto';
import {
  UnitResponseDto,
  ImportUnitsResponseDto,
} from './dto/unit-response.dto';
import { UnitOnboardingChecklistItemDto } from './dto/unit-onboarding.dto';

@ApiTags('units')
@ApiStandardResponses({ conflict: true })
@Controller('condominiums/:condominiumId/units')
@UseGuards(CondominiumMemberGuard)
export class UnitsController {
  constructor(private readonly service: UnitsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Cria unidade no condomínio' })
  @ApiCreatedResponse({
    description: 'Unidade criada com sucesso.',
    type: UnitResponseDto,
  })
  create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: CreateUnitDto,
  ) {
    return this.service.create(condominiumId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Lista unidades do condomínio' })
  @ApiOkResponse({
    description: 'Unidades retornadas com sucesso.',
    type: UnitResponseDto,
    isArray: true,
  })
  list(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.list(condominiumId);
  }

  @Get('onboarding-checklist')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({
    summary: 'Checklist de onboarding por unidade',
    description:
      'Mostra prontidão operacional de cada unidade (moradores, responsável, acesso, convite e cobrança do mês).',
  })
  @ApiOkResponse({
    description: 'Checklist retornado com sucesso.',
    type: UnitOnboardingChecklistItemDto,
    isArray: true,
  })
  onboardingChecklist(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ) {
    return this.service.onboardingChecklist(condominiumId);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Importa unidades via CSV' })
  @ApiCreatedResponse({
    description: 'Importação executada com sucesso.',
    type: ImportUnitsResponseDto,
  })
  importCsv(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: ImportUnitsDto,
  ) {
    return this.service.importCsv(condominiumId, dto.csv);
  }

  @Patch(':unitId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Atualiza unidade do condomínio' })
  @ApiOkResponse({
    description: 'Unidade atualizada com sucesso.',
    type: UnitResponseDto,
  })
  update(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.service.update(condominiumId, unitId, dto);
  }
}
