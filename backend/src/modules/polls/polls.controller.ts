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
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PollsService } from './polls.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import {
  PollResponseDto,
  PollResultsResponseDto,
  PollVoteResponseDto,
} from './dto/poll-response.dto';
import { PollMyParticipationResponseDto } from './dto/poll-my-participation.dto';

@ApiTags('polls')
@ApiStandardResponses({ unprocessable: true })
@Controller('condominiums/:condominiumId/polls')
@UseGuards(CondominiumMemberGuard)
export class PollsController {
  constructor(private readonly service: PollsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cria enquete no condomínio' })
  @ApiCreatedResponse({
    description: 'Enquete criada com sucesso.',
    type: PollResponseDto,
  })
  create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePollDto,
  ) {
    return this.service.create(condominiumId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista enquetes do condomínio' })
  @ApiOkResponse({
    description: 'Enquetes retornadas com sucesso.',
    type: PollResponseDto,
    isArray: true,
  })
  list(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.list(condominiumId);
  }

  @Get('participation')
  @ApiOperation({
    summary:
      'Participação do usuário nas enquetes (pode votar, já votou, opção escolhida)',
  })
  @ApiOkResponse({
    description: 'Resumo sem totais agregados para enquetes abertas.',
    type: PollMyParticipationResponseDto,
  })
  myParticipation(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.myParticipation(condominiumId, user.id);
  }

  @Get(':pollId/results')
  @ApiOperation({ summary: 'Retorna resultados da enquete (após fechamento)' })
  @ApiOkResponse({
    description: 'Resultado retornado com sucesso.',
    type: PollResultsResponseDto,
  })
  results(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
  ) {
    return this.service.results(condominiumId, pollId);
  }

  @Get(':pollId')
  @ApiOperation({ summary: 'Retorna detalhes de enquete' })
  @ApiOkResponse({
    description: 'Enquete retornada com sucesso.',
    type: PollResponseDto,
  })
  getOne(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
  ) {
    return this.service.getOne(condominiumId, pollId);
  }

  @Post(':pollId/close')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Encerra enquete manualmente' })
  @ApiOkResponse({
    description: 'Enquete encerrada com sucesso.',
    type: PollResponseDto,
  })
  close(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('pollId', ParseUUIDPipe) pollId: string,
  ) {
    return this.service.close(condominiumId, pollId);
  }
}

@ApiTags('polls')
@ApiStandardResponses()
@Controller('polls')
export class PollVoteController {
  constructor(private readonly service: PollsService) {}

  @Post(':id/vote')
  @ApiOperation({ summary: 'Registra voto do responsável financeiro' })
  @ApiCreatedResponse({
    description: 'Voto registrado com sucesso.',
    type: PollVoteResponseDto,
  })
  vote(
    @Param('id', ParseUUIDPipe) pollId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: VotePollDto,
  ) {
    return this.service.voteByPollId(pollId, user.id, dto.optionId);
  }
}
