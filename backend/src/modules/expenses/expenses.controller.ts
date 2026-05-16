import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { CondominiumMemberGuard } from '../../common/guards/condominium-member.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import {
  ExpenseResponseDto,
  ExpenseSummaryRowDto,
} from './dto/expense-response.dto';
import { OkResponseDto } from '../../common/dto/common-response.dto';

@ApiTags('expenses')
@ApiStandardResponses()
@Controller('condominiums/:condominiumId/expenses')
@UseGuards(CondominiumMemberGuard)
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Lista despesas do condomínio' })
  @ApiOkResponse({
    description: 'Despesas retornadas com sucesso.',
    type: ExpenseResponseDto,
    isArray: true,
  })
  list(@Param('condominiumId', ParseUUIDPipe) condominiumId: string) {
    return this.service.list(condominiumId);
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Resumo de despesas por categoria/período' })
  @ApiOkResponse({
    description: 'Resumo calculado com sucesso.',
    type: ExpenseSummaryRowDto,
    isArray: true,
  })
  summary(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.summary(condominiumId, from, to);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Cria despesa (com anexo opcional)' })
  @ApiCreatedResponse({
    description: 'Despesa criada com sucesso.',
    type: ExpenseResponseDto,
  })
  async create(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto = plainToInstance(CreateExpenseDto, {
      ...body,
      amount: body.amount !== undefined ? Number(body.amount) : body.amount,
    });
    await validateOrReject(dto);
    return this.service.create(condominiumId, user.id, dto, file);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Atualiza despesa' })
  @ApiOkResponse({
    description: 'Despesa atualizada com sucesso.',
    type: ExpenseResponseDto,
  })
  update(
    @Param('condominiumId', ParseUUIDPipe) condominiumId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.service.update(condominiumId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUB_ADMIN)
  @ApiOperation({ summary: 'Remove despesa' })
  @ApiOkResponse({
    description: 'Despesa removida com sucesso.',
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
