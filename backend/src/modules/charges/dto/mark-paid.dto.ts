import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MarkPaidDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paidAt?: string;
}
