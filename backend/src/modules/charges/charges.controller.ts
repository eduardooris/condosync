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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { UserRole } from '../../common/enums';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { ChargesService } from './charges.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { GenerateMonthDto } from './dto/generate-month.dto';
import {
  ChargeResponseDto,
  GenerateMonthResponseDto,
} from './dto/charge-response.dto';
import { ResendWhatsappResponseDto } from './dto/resend-whatsapp.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';

/**
 * Listagem e administração de cobranças por condomínio.
 * Restrita a `ADMIN` / `SUB_ADMIN` para evitar vazamento entre unidades
 * (US-08 fala em "minhas cobranças" — endpoint próprio em
 * {@link CondominiumMyChargesController}).
 */
@ApiBearerAuth('bearer')
@ApiTags('charges')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Sem permissão (síndico/subsíndico apenas).',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/charges')
@UseGuards(CondominiumMemberGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
export class CondominiumChargesController {
  constructor(private readonly service: ChargesService) {}

  // Rotas com path estático vêm antes de :chargeId quando necessário; aqui
  // :chargeId/resend-whatsapp não colide com generate (POST generate).

  @Get()
  @ApiOperation({ summary: 'Lista todas as cobranças do condomínio (admin)' })
  @ApiOkResponse({
    description: 'Cobranças retornadas com sucesso.',
    type: ChargeResponseDto,
    isArray: true,
  })
  list(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.list(condominiumId);
  }

  /** Não registrar este controller antes de {@link CondominiumMyChargesController}
   * — senão `GET .../charges/mine` casa aqui com `chargeId = mine` e morador leva 403. */
  @Get(':chargeId')
  @ApiOperation({ summary: 'Detalhe de uma cobrança específica (admin)' })
  @ApiOkResponse({
    description: 'Cobrança encontrada.',
    type: ChargeResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Cobrança não encontrada no condomínio informado.',
    type: ErrorResponseDto,
  })
  getOne(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ) {
    return this.service.getOneInCondo(condominiumId, chargeId);
  }

  @Post()
  @ApiOperation({ summary: 'Cria cobrança manual para uma unidade' })
  @ApiCreatedResponse({
    description: 'Cobrança criada com sucesso.',
    type: ChargeResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Payload inválido ou unidade isenta/duplicidade no mês.',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Condomínio ou unidade não encontrados.',
    type: ErrorResponseDto,
  })
  create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: CreateChargeDto,
  ) {
    return this.service.create(condominiumId, dto);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Gera cobranças mensais para todas as unidades ocupadas',
    description:
      'RN-03.1 — Quando `billingMonth` é omitido, usa o mês corrente em America/Sao_Paulo.',
  })
  @ApiCreatedResponse({
    description: 'Geração de cobranças concluída.',
    type: GenerateMonthResponseDto,
  })
  generate(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: GenerateMonthDto,
  ) {
    return this.service.generateMonth(condominiumId, dto.billingMonth);
  }

  @Post(':chargeId/resend-whatsapp')
  @ApiOperation({
    summary: 'Reenvia segunda via da cobrança no WhatsApp',
    description:
      'Enfileira envio de mensagem (segunda via) ao responsável financeiro. Exige WhatsApp do condomínio configurado.',
  })
  @ApiOkResponse({
    description: 'Mensagem enfileirada para envio.',
    type: ResendWhatsappResponseDto,
  })
  resendWhatsapp(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ) {
    return this.service.resendWhatsappNotification(
      user.id,
      condominiumId,
      chargeId,
    );
  }

  @Patch(':chargeId')
  @ApiOperation({
    summary: 'Atualiza dados editáveis de cobrança (valor/vencimento)',
    description:
      'O `status` não é alterável aqui — use `mark-paid`, `exempt` ou aguarde o job de overdue.',
  })
  @ApiOkResponse({
    description: 'Cobrança atualizada com sucesso.',
    type: ChargeResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Cobrança não encontrada no condomínio informado.',
    type: ErrorResponseDto,
  })
  update(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: UpdateChargeDto,
  ) {
    return this.service.update(condominiumId, chargeId, dto);
  }
}

/**
 * Endpoint pessoal — qualquer membro do condomínio (incl. RESIDENT)
 * pode ver as próprias cobranças. Filtro por `user_id` no service.
 */
@ApiBearerAuth('bearer')
@ApiTags('charges')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/charges/mine')
@UseGuards(CondominiumMemberGuard)
export class CondominiumMyChargesController {
  constructor(private readonly service: ChargesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as cobranças do usuário autenticado no condomínio',
    description:
      'US-08 — retorna cobranças de todas as unidades em que o usuário está cadastrado como morador.',
  })
  @ApiOkResponse({
    description: 'Cobranças do usuário.',
    type: ChargeResponseDto,
    isArray: true,
  })
  listMine(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ) {
    return this.service.listMineInCondo(user.id, condominiumId);
  }

  @Get(':chargeId')
  @ApiOperation({
    summary: 'Detalhe de uma cobrança do usuário autenticado',
    description:
      'Retorna a cobrança com o `pixCode` calculado quando em aberto.',
  })
  @ApiOkResponse({
    description: 'Cobrança encontrada.',
    type: ChargeResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Cobrança não encontrada no condomínio.',
    type: ErrorResponseDto,
  })
  getMine(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
  ) {
    return this.service.getMineInCondo(user.id, condominiumId, chargeId);
  }

  @Patch(':chargeId/mark-paid')
  @ApiOperation({
    summary: 'Morador confirma pagamento (auto-declaração)',
    description:
      'US-08 — o morador declara que pagou a cobrança via Pix. Valida que a unidade da cobrança tem o usuário vinculado. Em V2 com `IPaymentAdapter`, esta rota apenas move para `PENDING_CONFIRMATION` e o webhook do banco confirma.',
  })
  @ApiOkResponse({
    description: 'Cobrança marcada como paga.',
    type: ChargeResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Cobrança não encontrada ou não pertence ao morador.',
    type: ErrorResponseDto,
  })
  markPaidMine(
    @CurrentUser() user: RequestUser,
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('chargeId', ParseUUIDPipe) chargeId: string,
    @Body() dto: MarkPaidDto,
  ) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined;
    return this.service.markPaidByResident(
      user.id,
      condominiumId,
      chargeId,
      paidAt,
    );
  }
}
