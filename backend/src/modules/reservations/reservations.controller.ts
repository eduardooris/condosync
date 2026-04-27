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
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { UserRole } from '../../common/enums';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import {
  CreateReservationAreaDto,
  ReservationAreaResponseDto,
  UpdateReservationAreaDto,
} from './dto/reservation-area.dto';
import {
  CancelReservationDto,
  CreateReservationDto,
  RejectReservationDto,
  ReservationResponseDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiBearerAuth('bearer')
@ApiTags('reservations')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiStandardResponses({ conflict: true })
@Controller('condominiums/:condominiumId/reservations')
@UseGuards(CondominiumMemberGuard)
export class ReservationsController {
  constructor(private readonly service: ReservationsService) {}

  @Get('areas')
  @ApiOperation({ summary: 'Lista áreas reserváveis do condomínio' })
  @ApiOkResponse({ type: ReservationAreaResponseDto, isArray: true })
  listAreas(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.listAreas(condominiumId);
  }

  @Post('areas')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Cria área reservável' })
  @ApiCreatedResponse({ type: ReservationAreaResponseDto })
  createArea(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: CreateReservationAreaDto,
  ) {
    return this.service.createArea(condominiumId, dto);
  }

  @Patch('areas/:areaId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Atualiza configurações de área reservável' })
  @ApiOkResponse({ type: ReservationAreaResponseDto })
  updateArea(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: UpdateReservationAreaDto,
  ) {
    return this.service.updateArea(condominiumId, areaId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista reservas do condomínio' })
  @ApiOkResponse({ type: ReservationResponseDto, isArray: true })
  listReservations(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ) {
    return this.service.listReservations(condominiumId);
  }

  @Post()
  @ApiOperation({ summary: 'Solicita nova reserva de área comum' })
  @ApiCreatedResponse({ type: ReservationResponseDto })
  createReservation(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.service.createReservation(user.id, condominiumId, dto);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Aprova reserva pendente' })
  @ApiOkResponse({ type: ReservationResponseDto })
  approve(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(user.id, condominiumId, id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Recusa reserva pendente' })
  @ApiOkResponse({ type: ReservationResponseDto })
  reject(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReservationDto,
  ) {
    return this.service.reject(user.id, condominiumId, id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancela reserva' })
  @ApiOkResponse({ type: ReservationResponseDto })
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.service.cancel(user.id, condominiumId, id, dto);
  }
}
