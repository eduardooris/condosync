import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class VotePollDto {
  @ApiProperty()
  @IsUUID()
  optionId: string;
}
