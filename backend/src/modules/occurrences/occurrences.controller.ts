import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SignedUrlResponseDto } from '../../common/dto/common-response.dto';
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
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { OccurrencesService } from './occurrences.service';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { UpdateOccurrenceStatusDto } from './dto/update-occurrence-status.dto';
import { OccurrenceResponseDto } from './dto/occurrence-response.dto';

@ApiBearerAuth('bearer')
@ApiTags('occurrences')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Sem acesso ao condomínio ou papel insuficiente.',
  type: ErrorResponseDto,
})
@Controller('condominiums/:condominiumId/occurrences')
@UseGuards(CondominiumMemberGuard)
export class OccurrencesController {
  constructor(private readonly service: OccurrencesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista ocorrências do condomínio',
    description:
      'RN-05.3 — usuários comuns NÃO veem identidade da unidade quando a ocorrência é anônima.',
  })
  @ApiOkResponse({
    description: 'Ocorrências retornadas com sucesso.',
    type: OccurrenceResponseDto,
    isArray: true,
  })
  list(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CondominiumMembership() membership: CondominiumMembershipContext,
  ) {
    return this.service.list(condominiumId, membership.role);
  }

  @Post()
  @UseInterceptors(FileInterceptor('attachment'))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary: 'Abre nova ocorrência (com anexo opcional)',
    description:
      'US-06 — aceita `application/json` (sem anexo) ou `multipart/form-data` ' +
      'com campo `attachment` para imagens/documentos. O arquivo é salvo via ' +
      'IStorageAdapter e a chave é persistida em `attachmentStorageKey`.',
  })
  @ApiBody({
    description:
      'Campos do DTO em multipart (use `attachment` para o arquivo).',
    schema: {
      type: 'object',
      properties: {
        unitId: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        category: { type: 'string' },
        description: { type: 'string' },
        isAnonymous: { type: 'boolean' },
        attachment: { type: 'string', format: 'binary' },
      },
      required: ['unitId', 'title', 'category', 'description'],
    },
  })
  @ApiCreatedResponse({
    description: 'Ocorrência criada com sucesso.',
    type: OccurrenceResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Unidade não encontrada no condomínio informado.',
    type: ErrorResponseDto,
  })
  async create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: CreateOccurrenceDto | Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto =
      body instanceof CreateOccurrenceDto
        ? body
        : plainToInstance(CreateOccurrenceDto, body, {
            enableImplicitConversion: true,
          });
    await validateOrReject(dto);
    return this.service.create(condominiumId, user.id, dto, file);
  }

  @Get(':id/attachment-url')
  @ApiOperation({
    summary: 'Gera URL assinada para baixar anexo da ocorrência',
    description: 'Apenas o autor ou síndico/sub-síndico podem solicitar a URL.',
  })
  @ApiOkResponse({
    description: 'URL assinada gerada com sucesso.',
    type: SignedUrlResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ocorrência sem anexo ou inexistente.',
    type: ErrorResponseDto,
  })
  signedAttachment(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @CondominiumMembership() membership: CondominiumMembershipContext,
  ) {
    return this.service.signedAttachmentUrl(
      condominiumId,
      id,
      membership.role,
      user.id,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Atualiza status da ocorrência',
    description:
      'RN-05.1 — apenas o síndico (ADMIN) pode mudar status; o subsíndico tem acesso somente leitura.',
  })
  @ApiOkResponse({
    description: 'Status atualizado com sucesso.',
    type: OccurrenceResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Transição de status inválida.',
    type: ErrorResponseDto,
  })
  updateStatus(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOccurrenceStatusDto,
  ) {
    return this.service.updateStatus(condominiumId, id, dto.status);
  }
}
