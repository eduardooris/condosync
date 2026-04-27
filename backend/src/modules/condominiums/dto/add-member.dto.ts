import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';
import { UserRole } from '../../../common/enums';

/**
 * Apenas papéis administrativos podem ser concedidos por este endpoint.
 *
 * RESPONSIBLE / RESIDENT são derivados do cadastro de moradores
 * (`POST /condominiums/:id/units/:unitId/residents`) — adicionar
 * diretamente via `addMember` permitiria contornar a regra de
 * "responsável financeiro único por unidade".
 */
const ALLOWED_ROLES = [UserRole.ADMIN, UserRole.SUB_ADMIN] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

export class AddMemberDto {
  @ApiProperty({
    example: 'sindico@condominio.com.br',
    description: 'E-mail do usuário a ser vinculado.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    enum: ALLOWED_ROLES,
    example: UserRole.SUB_ADMIN,
    description:
      'Papel administrativo. Para morador/responsável, use o endpoint de residentes.',
  })
  @IsIn(ALLOWED_ROLES, {
    message:
      'Apenas ADMIN ou SUB_ADMIN podem ser atribuídos por este endpoint.',
  })
  role: AllowedRole;
}
