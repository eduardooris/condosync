import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OccurrenceStatus } from '../../../common/enums';

export class UpdateOccurrenceStatusDto {
  @ApiProperty({ enum: OccurrenceStatus })
  @IsEnum(OccurrenceStatus)
  status: OccurrenceStatus;
}
