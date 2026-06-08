import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';
import { NotificationsService } from './notifications.service';
import {
  NotificationResponseDto,
  NotificationsPageResponseDto,
  UnreadCountResponseDto,
  UpdatedCountResponseDto,
} from './dto/notification-response.dto';

@ApiBearerAuth('bearer')
@ApiTags('notifications')
@ApiUnauthorizedResponse({
  description: 'Token inválido/expirado.',
  type: ErrorResponseDto,
})
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista paginada de notificações do usuário autenticado',
    description:
      'Retorna até `limit` notificações em ordem cronológica decrescente. ' +
      'Para a próxima página, passe `before` com o valor de `nextCursor` da resposta anterior.',
  })
  @ApiQuery({
    name: 'unread',
    required: false,
    type: Boolean,
    description: 'Quando `true`, retorna somente notificações ainda não lidas.',
  })
  @ApiQuery({
    name: 'condominiumId',
    required: false,
    type: String,
    description:
      'Filtra notificações por condomínio (recomendado: passe o condomínio ativo do usuário).',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    description:
      'Cursor opaco (ISO `createdAt`). Devolva o `nextCursor` da página anterior aqui.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Itens por página (default 25, máx 100).',
  })
  @ApiOkResponse({
    description: 'Página de notificações.',
    type: NotificationsPageResponseDto,
  })
  async list(
    @CurrentUser() user: RequestUser,
    @Query('unread', new ParseBoolPipe({ optional: true })) unread?: boolean,
    @Query('condominiumId') condominiumId?: string,
    @Query('before') before?: string,
    @Query(
      'limit',
      new DefaultValuePipe(25),
      new ParseIntPipe({ optional: true }),
    )
    limit?: number,
  ): Promise<NotificationsPageResponseDto> {
    let beforeDate: Date | null = null;
    if (before) {
      const parsed = new Date(before);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(
          'Parâmetro `before` inválido — esperado ISO 8601.',
        );
      }
      beforeDate = parsed;
    }
    return this.service.listMine(user.id, {
      onlyUnread: unread === true,
      condominiumId: condominiumId ?? null,
      before: beforeDate,
      limit,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Quantidade de notificações não lidas' })
  @ApiQuery({
    name: 'condominiumId',
    required: false,
    type: String,
    description: 'Quando informado, conta apenas as não lidas do condomínio.',
  })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async unreadCount(
    @CurrentUser() user: RequestUser,
    @Query('condominiumId') condominiumId?: string,
  ): Promise<UnreadCountResponseDto> {
    return {
      unread: await this.service.countUnread(user.id, condominiumId ?? null),
    };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca notificação como lida' })
  @ApiOkResponse({ type: NotificationResponseDto })
  read(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Marca todas as notificações como lidas' })
  @ApiQuery({
    name: 'condominiumId',
    required: false,
    type: String,
    description:
      'Quando informado, marca como lidas apenas as do condomínio (escopo).',
  })
  @ApiOkResponse({ type: UpdatedCountResponseDto })
  readAll(
    @CurrentUser() user: RequestUser,
    @Query('condominiumId') condominiumId?: string,
  ) {
    return this.service.markAllRead(user.id, condominiumId ?? null);
  }
}
