import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiStandardResponses } from '../../../common/decorators/api-standard-responses.decorator';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import {
  RegisterDeviceDto,
  RegisterDeviceResponseDto,
} from './dto/intercom.dto';
import { IntercomService } from './intercom.service';

@ApiTags('intercom')
@ApiBearerAuth('bearer')
@ApiStandardResponses({ notFound: true })
@Controller('intercom/devices')
export class IntercomDevicesController {
  constructor(private readonly intercom: IntercomService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra dispositivo do morador para ring (push na v2)',
  })
  @ApiCreatedResponse({ type: RegisterDeviceResponseDto })
  register(@CurrentUser() user: RequestUser, @Body() dto: RegisterDeviceDto) {
    return this.intercom.registerDevice(user.id, dto);
  }
}
