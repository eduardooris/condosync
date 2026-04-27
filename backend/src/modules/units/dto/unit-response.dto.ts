import { ApiProperty } from '@nestjs/swagger';
import { UnitStatus, UnitType } from '../../../common/enums';

export class UnitResponseDto {
  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  id: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ example: 'A' })
  block: string;

  @ApiProperty({ example: '101' })
  number: string;

  @ApiProperty({ enum: UnitType, example: UnitType.APARTMENT })
  type: UnitType;

  @ApiProperty({ enum: UnitStatus, example: UnitStatus.OCCUPIED })
  status: UnitStatus;

  @ApiProperty({ example: '2026-01-10T13:42:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  updatedAt: Date;
}

export class ImportUnitsResponseDto {
  @ApiProperty({ example: 24 })
  count: number;
}
