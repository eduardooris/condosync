import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums';
import { MembershipStatus } from '../../../database/entities/user-condominium.entity';

export class MemberResponseDto {
  @ApiProperty({ example: '12da3a3c-1b1f-4e85-8d6f-9c4f7a7e0e44' })
  membershipId: string;

  @ApiProperty({ example: 'd1a6ee0d-8b86-4c36-bbe2-066d88f5d886' })
  userId: string;

  @ApiProperty({ example: 'sindico@condosync.com' })
  email: string;

  @ApiPropertyOptional({ example: 'Eduardo Oris', nullable: true })
  fullName: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.SUB_ADMIN })
  role: UserRole;

  @ApiProperty({ enum: MembershipStatus, example: MembershipStatus.APPROVED })
  status: MembershipStatus;

  @ApiPropertyOptional({
    example: '5b0e5b96-0dcb-4aab-8e2b-1c40b2b3e441',
    nullable: true,
  })
  unitId: string | null;

  @ApiProperty({ example: '2026-04-22T11:00:00.000Z' })
  createdAt: Date;
}
