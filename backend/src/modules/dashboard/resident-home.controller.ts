import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { ResidentHomeService } from './resident-home.service';
import { ResidentHomeSummaryDto } from './dto/resident-home.dto';

/**
 * Endpoints "pessoais" do usuário autenticado — não dependem de
 * passar `condominiumId` na URL (resolvido pela membership). Mantemos
 * dentro do módulo `dashboard` por afinidade temática (resumo de Home).
 */
@ApiBearerAuth('bearer')
@ApiTags('dashboard')
@ApiStandardResponses({ notFound: false })
@Controller('me')
export class ResidentHomeController {
  constructor(private readonly service: ResidentHomeService) {}

  @Get('home-summary')
  @ApiOperation({
    summary: 'Resumo da Home do morador (próxima cobrança, encomendas etc.)',
    description:
      'Consolida em uma única requisição os widgets exibidos na Home do app: próxima cobrança, contagem de cobranças em aberto, encomendas aguardando, próxima reserva, post fixado do mural e contador de notificações não lidas.',
  })
  @ApiOkResponse({
    description: 'Resumo retornado com sucesso.',
    type: ResidentHomeSummaryDto,
  })
  homeSummary(
    @CurrentUser() user: RequestUser,
    @Query('condominiumId') condominiumId?: string,
  ) {
    return this.service.buildSummary(user.id, condominiumId);
  }
}
