import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ImportUnitsDto {
  @ApiProperty({
    description: 'Conteúdo CSV com colunas block, number, type, status',
  })
  @IsString()
  @IsNotEmpty()
  csv: string;
}
