import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/decorators/api-standard-responses.decorator';
import { IntercomWebRtcConfigDto } from './dto/intercom.dto';
import { IntercomService } from './intercom.service';

@ApiTags('intercom')
@ApiBearerAuth('bearer')
@ApiStandardResponses()
@Controller('intercom')
export class IntercomConfigController {
  constructor(private readonly intercom: IntercomService) {}

  @Get('webrtc-config')
  @ApiOperation({
    summary: 'Servidores ICE/STUN/TURN para WebRTC (morador)',
  })
  @ApiOkResponse({ type: IntercomWebRtcConfigDto })
  getWebRtcConfig(): IntercomWebRtcConfigDto {
    return { iceServers: this.intercom.getIceServers() };
  }
}
