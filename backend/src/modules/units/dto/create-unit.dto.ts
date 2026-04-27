import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { UnitStatus, UnitType } from '../../../common/enums';

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  block: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiPropertyOptional({ enum: UnitType })
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}
