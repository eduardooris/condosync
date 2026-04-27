import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseApprovalStatus, ExpenseCategory } from '../../../common/enums';

export class ExpenseResponseDto {
  @ApiProperty({ example: '4f145bb6-d570-4559-8dab-5a8fbe6da6ab' })
  id: string;

  @ApiProperty({ example: 'b5a6acbb-f664-4f62-9692-93887d9aafef' })
  condominiumId: string;

  @ApiProperty({ example: 'Manutenção elevador' })
  description: string;

  @ApiProperty({ example: '350.00' })
  amount: string;

  @ApiProperty({ example: '2026-04-20' })
  expenseDate: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.MAINTENANCE })
  category: ExpenseCategory;

  @ApiPropertyOptional({ example: 'Empresa Elevadores LTDA', nullable: true })
  vendor: string | null;

  @ApiPropertyOptional({
    example: 'expenses/b5a6acbb.../nota-fiscal.pdf',
    nullable: true,
  })
  storageKey: string | null;

  @ApiProperty({
    enum: ExpenseApprovalStatus,
    example: ExpenseApprovalStatus.APPROVED,
  })
  approvalStatus: ExpenseApprovalStatus;

  @ApiPropertyOptional({
    example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886',
    nullable: true,
  })
  createdByUserId: string | null;

  @ApiProperty({ example: '2026-04-20T11:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-20T11:00:00.000Z' })
  updatedAt: Date;
}

export class ExpenseSummaryRowDto {
  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.MAINTENANCE })
  category: ExpenseCategory;

  @ApiProperty({ example: '1200.00' })
  total: string;
}
