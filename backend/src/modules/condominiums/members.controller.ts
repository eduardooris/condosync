import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/decorators/api-standard-responses.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums';
import { MembersService } from './members.service';
import { MemberResponseDto } from './dto/member-response.dto';
import { ApproveMemberDto, UpdateMemberDto } from './dto/member-actions.dto';
import { OkResponseDto } from '../../common/dto/common-response.dto';

@ApiTags('members')
@ApiBearerAuth('bearer')
@ApiStandardResponses({ conflict: true, unprocessable: true })
@Controller('condominiums/:condominiumId/members')
@UseGuards(CondominiumMemberGuard, RolesGuard)
export class MembersController {
  constructor(private readonly service: MembersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Lista membros aprovados do condomínio' })
  @ApiOkResponse({
    description: 'Lista retornada com sucesso.',
    type: MemberResponseDto,
    isArray: true,
  })
  list(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.listApproved(condominiumId);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Lista membros aguardando aprovação' })
  @ApiOkResponse({
    description: 'Lista retornada com sucesso.',
    type: MemberResponseDto,
    isArray: true,
  })
  listPending(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.listPending(condominiumId);
  }

  @Post(':membershipId/approve')
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({
    summary: 'Aprova membership PENDING (define role/unidade definitivos)',
  })
  @ApiOkResponse({
    description: 'Membership aprovado.',
    type: MemberResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Sem permissão.' })
  approve(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: ApproveMemberDto,
  ) {
    return this.service.approve(condominiumId, membershipId, dto);
  }

  @Post(':membershipId/reject')
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Rejeita membership PENDING (remove o vínculo)' })
  @ApiOkResponse({ description: 'Rejeitado.', type: OkResponseDto })
  async reject(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ): Promise<OkResponseDto> {
    await this.service.reject(condominiumId, membershipId);
    return { ok: true };
  }

  @Patch(':membershipId')
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Atualiza role/unidade de um membro aprovado' })
  @ApiOkResponse({
    description: 'Membership atualizado.',
    type: MemberResponseDto,
  })
  update(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.service.update(condominiumId, membershipId, dto);
  }

  @Delete(':membershipId')
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Remove membro do condomínio' })
  @ApiOkResponse({ description: 'Membro removido.', type: OkResponseDto })
  async remove(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ): Promise<OkResponseDto> {
    await this.service.remove(condominiumId, membershipId);
    return { ok: true };
  }
}
