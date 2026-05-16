import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { DashboardService } from './dashboard.service';
import {
  DashboardChartRowDto,
  DashboardSummaryResponseDto,
} from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiStandardResponses({ notFound: false })
@Controller('condominiums/:condominiumId/dashboard')
@UseGuards(CondominiumMemberGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Resumo financeiro do condomínio' })
  @ApiOkResponse({
    description: 'Resumo retornado com sucesso.',
    type: DashboardSummaryResponseDto,
  })
  summary(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.summary(condominiumId);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Série mensal de receitas x despesas' })
  @ApiOkResponse({
    description: 'Dados do gráfico retornados com sucesso.',
    type: DashboardChartRowDto,
    isArray: true,
  })
  chart(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.chart(condominiumId);
  }
}
