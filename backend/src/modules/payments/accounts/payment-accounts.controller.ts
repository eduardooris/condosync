import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/decorators/api-standard-responses.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CondominiumMemberGuard } from '../../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums';
import { ErrorResponseDto } from '../../../common/dto/error-response.dto';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import {
  CreatePaymentAccountResponseDto,
  PaymentAccountResponseDto,
} from './dto/payment-account-response.dto';
import { PaymentAccountsService } from './payment-accounts.service';

/**
 * Endpoints da subconta Asaas — operações exclusivas do síndico do
 * condomínio (`ADMIN`). `SUB_ADMIN` consulta status mas não cria/refresh.
 *
 * Todas as rotas usam o `CondominiumMemberGuard` (resolve `condominiumId`
 * do path + membership do `currentUser`) + `RolesGuard` (papel mínimo).
 */
@ApiTags('payments')
@ApiBearerAuth('bearer')
@ApiStandardResponses({ notFound: true, unprocessable: true })
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/payment-account')
@UseGuards(CondominiumMemberGuard, RolesGuard)
export class PaymentAccountsController {
  constructor(private readonly service: PaymentAccountsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cria a subconta Asaas do condomínio (setup wizard)',
    description:
      'Cria a conta digital que receberá os pagamentos. Após criada, o ' +
      'síndico precisa enviar documentos pelo link de onboarding antes do ' +
      'status ficar `ACTIVE`. Idempotente: chamar duas vezes com status ' +
      'diferente de `REJECTED` retorna 409.',
  })
  @ApiCreatedResponse({
    type: CreatePaymentAccountResponseDto,
    description: 'Subconta criada com sucesso.',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Condomínio já possui subconta ativa ou em análise.',
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Usuário não é o síndico (ADMIN) deste condomínio.',
  })
  create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Body() dto: CreatePaymentAccountDto,
  ): Promise<CreatePaymentAccountResponseDto> {
    return this.service.create(condominiumId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({
    summary: 'Status atual da subconta de pagamento',
    description:
      'Retorna `null` (204) quando o condomínio ainda não criou a subconta.',
  })
  @ApiOkResponse({
    type: PaymentAccountResponseDto,
    description: 'Subconta encontrada.',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Condomínio sem subconta — chame POST para criar.',
  })
  async getStatus(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ): Promise<PaymentAccountResponseDto> {
    const account = await this.service.getStatus(condominiumId);
    if (!account) {
      // 404 sinaliza "ainda não criada" — frontend exibe CTA de setup.
      throw new NotFoundException(
        'Subconta de pagamento ainda não criada para este condomínio.',
      );
    }
    return account;
  }

  @Post('refresh')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-checa status na Asaas e atualiza local',
    description:
      'Útil quando o síndico acaba de enviar documentos e quer saber se já ' +
      'foram aprovados. Idempotente.',
  })
  @ApiOkResponse({ type: PaymentAccountResponseDto })
  refresh(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ): Promise<PaymentAccountResponseDto> {
    return this.service.refresh(condominiumId);
  }

  @Post('onboarding-link')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gera novo link de onboarding (envio de documentos)',
    description:
      'O link da Asaas expira em poucas horas. Use este endpoint para gerar ' +
      'um novo quando o síndico perdeu o link anterior ou quando ele expirou.',
  })
  @ApiOkResponse({ type: PaymentAccountResponseDto })
  refreshOnboardingLink(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
  ): Promise<PaymentAccountResponseDto> {
    return this.service.refreshOnboardingLink(condominiumId);
  }
}
