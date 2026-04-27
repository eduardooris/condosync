import { ApiProperty } from '@nestjs/swagger';
import { ExpenseResponseDto } from '../../expenses/dto/expense-response.dto';

export class DashboardSummaryResponseDto {
  @ApiProperty({ example: 5600.35 })
  saldoAtual: number;

  @ApiProperty({ example: 7 })
  inadimplenciaUnidades: number;

  @ApiProperty({ example: 14200 })
  totalReceitasPagas: number;

  @ApiProperty({ example: 8599.65 })
  totalDespesasAprovadas: number;

  @ApiProperty({ type: [ExpenseResponseDto] })
  ultimasDespesas: ExpenseResponseDto[];
}

export class DashboardChartRowDto {
  @ApiProperty({ example: '2026-01' })
  month: string;

  @ApiProperty({ example: '12000.00' })
  receitas: string;

  @ApiProperty({ example: '9400.00' })
  despesas: string;
}
