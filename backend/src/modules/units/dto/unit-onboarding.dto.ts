import { ApiProperty } from '@nestjs/swagger';

export class UnitOnboardingChecklistItemDto {
  @ApiProperty({ example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0' })
  unitId: string;

  @ApiProperty({ example: 'A' })
  block: string;

  @ApiProperty({ example: '101' })
  number: string;

  @ApiProperty({ example: true })
  hasResidents: boolean;

  @ApiProperty({ example: true })
  hasFinancialResponsible: boolean;

  @ApiProperty({ example: false })
  hasActiveAppAccess: boolean;

  @ApiProperty({ example: true })
  hasPendingInvitation: boolean;

  @ApiProperty({ example: false })
  hasCurrentMonthCharge: boolean;

  @ApiProperty({
    example: 3,
    description: 'Pontuação de prontidão (0..5).',
  })
  score: number;

  @ApiProperty({ example: false })
  isReady: boolean;
}
