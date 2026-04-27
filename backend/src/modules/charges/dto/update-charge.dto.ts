import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  Matches,
} from 'class-validator';

/**
 * Atualização de cobrança limita-se a campos editáveis
 * **antes** da liquidação. O `status` é controlado pela máquina de
 * estados em `charge-status.machine.ts` — use os endpoints específicos
 * (`/mark-paid`, `/exempt`).
 */
export class UpdateChargeDto {
  @ApiPropertyOptional({
    example: 350.5,
    description: 'Novo valor da cobrança (apenas se ainda PENDING/OVERDUE).',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    example: '2026-04-10',
    description: 'Nova data de vencimento (ISO-8601 yyyy-mm-dd).',
  })
  @IsOptional()
  @IsISO8601()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;
}
