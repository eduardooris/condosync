import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '../../../common/enums';

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: UserRole, example: UserRole.SUB_ADMIN })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: '5b0e5b96-0dcb-4aab-8e2b-1c40b2b3e441',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;
}

export class ApproveMemberDto {
  @ApiProperty({ enum: UserRole, example: UserRole.RESIDENT })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    example: '5b0e5b96-0dcb-4aab-8e2b-1c40b2b3e441',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;
}
