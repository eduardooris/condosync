import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { ApiStandardResponses } from '../../../common/decorators/api-standard-responses.decorator';
import {
  CancelIntercomSessionDto,
  CreateIntercomSessionDto,
  CreateIntercomSessionResponseDto,
  IntercomSessionStatusDto,
  PortariaUnitDto,
} from './dto/intercom.dto';
import { IntercomPublicThrottlerGuard } from './intercom-public-throttler.guard';
import { IntercomService } from './intercom.service';

@ApiTags('intercom')
@ApiStandardResponses({ notFound: true })
@Controller('portaria')
@Throttle({
  default: { limit: 30, ttl: 60_000 },
})
export class IntercomPublicController {
  constructor(private readonly intercom: IntercomService) {}

  @Public()
  @Get(':accessToken/units')
  @ApiOperation({
    summary: 'Lista unidades ocupadas (visitante na portaria)',
  })
  @ApiOkResponse({ type: PortariaUnitDto, isArray: true })
  listUnits(@Param('accessToken') accessToken: string) {
    return this.intercom.listPublicUnits(accessToken);
  }

  @Public()
  @Post(':accessToken/sessions')
  @UseGuards(IntercomPublicThrottlerGuard)
  @Throttle({ 'intercom-sessions': { limit: 10, ttl: 300_000 } })
  @ApiOperation({ summary: 'Inicia sessão de interfone' })
  @ApiCreatedResponse({ type: CreateIntercomSessionResponseDto })
  createSession(
    @Param('accessToken') accessToken: string,
    @Body() dto: CreateIntercomSessionDto,
  ) {
    return this.intercom.createSession(accessToken, dto);
  }

  @Public()
  @Get('sessions/:sessionId/status')
  @ApiOperation({
    summary: 'Status da sessão (polling visitante)',
  })
  @ApiOkResponse({ type: IntercomSessionStatusDto })
  sessionStatus(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.intercom.getPublicSessionStatus(sessionId);
  }

  @Public()
  @Post('sessions/:sessionId/cancel')
  @ApiOperation({ summary: 'Visitante cancela chamada' })
  @ApiOkResponse({ type: IntercomSessionStatusDto })
  cancelSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CancelIntercomSessionDto,
  ) {
    return this.intercom.cancelByVisitor(sessionId, dto.guestWsToken);
  }

  @Public()
  @Post('sessions/:sessionId/end')
  @ApiOperation({ summary: 'Visitante encerra chamada em andamento' })
  @ApiOkResponse({ type: IntercomSessionStatusDto })
  endAsGuest(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CancelIntercomSessionDto,
  ) {
    return this.intercom.endSession(null, sessionId, dto.guestWsToken);
  }
}
