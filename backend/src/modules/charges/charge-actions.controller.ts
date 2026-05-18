import { Body, Controller, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { ChargesService } from './charges.service';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ExemptChargeDto } from './dto/exempt-charge.dto';
import { CancelChargeDto } from './dto/cancel-charge.dto';
import { ChargeResponseDto } from './dto/charge-response.dto';

@ApiBearerAuth('bearer')
@ApiTags('charges')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Apenas síndico ou subsíndico podem executar a ação.',
  type: ErrorResponseDto,
})
@ApiNotFoundResponse({
  description: 'Cobrança não encontrada.',
  type: ErrorResponseDto,
})
@ApiBadRequestResponse({
  description: 'Transição de status inválida ou payload incorreto.',
  type: ErrorResponseDto,
})
@Controller('charges')
export class ChargeActionsController {
  constructor(private readonly service: ChargesService) {}

  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Marca cobrança como paga' })
  @ApiOkResponse({
    description: 'Cobrança marcada como paga.',
    type: ChargeResponseDto,
  })
  markPaid(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
  ) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined;
    return this.service.markPaid(user.id, id, paidAt, {
      method: dto.method,
      note: dto.note,
    });
  }

  @Patch(':id/exempt')
  @ApiOperation({
    summary: 'Isenta cobrança',
    description:
      'RN-03.2 — exige justificativa textual obrigatória, registrada em `exempt_reason`.',
  })
  @ApiOkResponse({
    description: 'Cobrança isentada com sucesso.',
    type: ChargeResponseDto,
  })
  exempt(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExemptChargeDto,
  ) {
    return this.service.exempt(user.id, id, dto.reason);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancela uma cobrança',
    description:
      'Marca a cobrança como CANCELED. Aceita um `reason` opcional. Status terminal — não pode ser revertido.',
  })
  @ApiOkResponse({
    description: 'Cobrança cancelada com sucesso.',
    type: ChargeResponseDto,
  })
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelChargeDto,
  ) {
    return this.service.cancel(user.id, id, dto.reason);
  }
}
