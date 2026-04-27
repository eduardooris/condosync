import {
  Controller,
  Get,
  Param,
  ParseBoolPipe,
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
  @ApiOperation({ summary: 'Lista notificações do usuário autenticado' })
  @ApiQuery({
    name: 'unread',
    required: false,
    type: Boolean,
    description: 'Quando `true`, retorna somente notificações ainda não lidas.',
  })
  @ApiOkResponse({
    description: 'Lista de notificações.',
    type: NotificationResponseDto,
    isArray: true,
  })
  list(
    @CurrentUser() user: RequestUser,
    @Query('unread', new ParseBoolPipe({ optional: true })) unread?: boolean,
  ) {
    return this.service.listMine(user.id, unread === true);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Quantidade de notificações não lidas' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async unreadCount(
    @CurrentUser() user: RequestUser,
  ): Promise<UnreadCountResponseDto> {
    return { unread: await this.service.countUnread(user.id) };
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
  @ApiOkResponse({ type: UpdatedCountResponseDto })
  readAll(@CurrentUser() user: RequestUser) {
    return this.service.markAllRead(user.id);
  }
}
