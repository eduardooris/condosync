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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import {
  CreateParcelDto,
  CreateVisitorEntryDto,
  ParcelResponseDto,
  UpdateParcelStatusDto,
  UpdateVisitorEntryStatusDto,
  VisitorEntryResponseDto,
} from './dto/visitors.dto';
import { VisitorsService } from './visitors.service';

@ApiBearerAuth('bearer')
@ApiTags('visitors')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiStandardResponses({ conflict: true })
@Controller('condominiums/:condominiumId/visitors')
@UseGuards(CondominiumMemberGuard)
export class VisitorsController {
  constructor(private readonly service: VisitorsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista visitantes esperados/chegadas no condomínio',
  })
  @ApiOkResponse({ type: VisitorEntryResponseDto, isArray: true })
  listVisitors(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.listVisitors(condominiumId);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra visitante previsto para uma unidade' })
  @ApiCreatedResponse({ type: VisitorEntryResponseDto })
  createVisitor(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: CreateVisitorEntryDto,
  ) {
    return this.service.createVisitor(user.id, condominiumId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualiza status de visitante (portaria/admin)' })
  @ApiOkResponse({ type: VisitorEntryResponseDto })
  updateVisitorStatus(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitorEntryStatusDto,
  ) {
    return this.service.updateVisitorStatus(user.id, condominiumId, id, dto);
  }

  @Get('parcels')
  @ApiOperation({ summary: 'Lista correspondências recebidas' })
  @ApiOkResponse({ type: ParcelResponseDto, isArray: true })
  listParcels(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.listParcels(condominiumId);
  }

  @Post('parcels')
  @ApiOperation({ summary: 'Registra nova correspondência recebida' })
  @ApiCreatedResponse({ type: ParcelResponseDto })
  createParcel(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: CreateParcelDto,
  ) {
    return this.service.createParcel(user.id, condominiumId, dto);
  }

  @Patch('parcels/:id/status')
  @ApiOperation({ summary: 'Atualiza status de correspondência' })
  @ApiOkResponse({ type: ParcelResponseDto })
  updateParcelStatus(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParcelStatusDto,
  ) {
    return this.service.updateParcelStatus(user.id, condominiumId, id, dto);
  }
}
