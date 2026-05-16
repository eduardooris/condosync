import { Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiStandardResponses } from '../../../common/decorators/api-standard-responses.decorator';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import { IntercomSessionStatusDto } from './dto/intercom.dto';
import { IntercomService } from './intercom.service';

@ApiTags('intercom')
@ApiBearerAuth('bearer')
@ApiStandardResponses({ conflict: true, notFound: true })
@Controller('intercom/sessions')
export class IntercomSessionsController {
  constructor(private readonly intercom: IntercomService) {}

  @Post(':sessionId/accept')
  @ApiOperation({ summary: 'Morador atende chamada da portaria' })
  @ApiOkResponse({ type: IntercomSessionStatusDto })
  accept(
    @CurrentUser() user: RequestUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.intercom.accept(user.id, sessionId);
  }

  @Post(':sessionId/reject')
  @ApiOperation({ summary: 'Morador recusa chamada da portaria' })
  @ApiOkResponse({ type: IntercomSessionStatusDto })
  reject(
    @CurrentUser() user: RequestUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.intercom.reject(user.id, sessionId);
  }

  @Post(':sessionId/end')
  @ApiOperation({ summary: 'Morador encerra chamada' })
  @ApiOkResponse({ type: IntercomSessionStatusDto })
  end(
    @CurrentUser() user: RequestUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.intercom.endSession(user.id, sessionId);
  }
}
