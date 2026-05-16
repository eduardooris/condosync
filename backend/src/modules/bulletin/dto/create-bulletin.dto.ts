import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { BulletinPriority } from '../../../common/enums';

export class CreateBulletinDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiProperty({ enum: BulletinPriority })
  @IsEnum(BulletinPriority)
  priority: BulletinPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Fixar no topo da listagem.' })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}
