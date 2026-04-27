import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import {
  OkResponseDto,
  SignedUrlResponseDto,
} from '../../common/dto/common-response.dto';

@ApiTags('documents')
@ApiStandardResponses()
@Controller('condominiums/:condominiumId/documents')
@UseGuards(CondominiumMemberGuard)
export class CondominiumDocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista documentos do condomínio' })
  @ApiOkResponse({
    description: 'Documentos retornados com sucesso.',
    type: DocumentResponseDto,
    isArray: true,
  })
  list(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.list(condominiumId, user.id);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Gera URL assinada para download de documento' })
  @ApiOkResponse({
    description: 'URL assinada gerada com sucesso.',
    type: SignedUrlResponseDto,
  })
  signedUrl(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.signedUrl(condominiumId, id, user.id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cria documento (upload)' })
  @ApiCreatedResponse({
    description: 'Documento criado com sucesso.',
    type: DocumentResponseDto,
  })
  async create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, string>,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Arquivo é obrigatório (campo "file" no multipart).',
      );
    }
    const dto = plainToInstance(CreateDocumentDto, body);
    await validateOrReject(dto);
    return this.service.create(condominiumId, user.id, dto, file);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Remove documento' })
  @ApiOkResponse({
    description: 'Documento removido com sucesso.',
    type: OkResponseDto,
  })
  async remove(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OkResponseDto> {
    await this.service.remove(condominiumId, id);
    return { ok: true };
  }
}

@ApiTags('documents')
@ApiStandardResponses()
@Controller('documents')
export class DocumentUrlController {
  constructor(private readonly service: DocumentsService) {}

  @Get(':id/url')
  @ApiOperation({ summary: 'Gera URL assinada por ID global do documento' })
  @ApiOkResponse({
    description: 'URL assinada gerada com sucesso.',
    type: SignedUrlResponseDto,
  })
  signedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.signedUrlFromId(id, user.id);
  }
}
