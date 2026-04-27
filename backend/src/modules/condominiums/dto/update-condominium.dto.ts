import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCondominiumDto } from './create-condominium.dto';

/**
 * Mantemos todos os campos editáveis do `Create`, exceto:
 *
 * - `cnpj`: imutável depois da criação (regra fiscal).
 *
 * O arquivamento é feito por `DELETE /condominiums/:id` (ou rota
 * dedicada de `unarchive`) para impedir que o subsíndico altere
 * `archivedAt` via PATCH e contorne RN-01.3.
 */
export class UpdateCondominiumDto extends PartialType(
  OmitType(CreateCondominiumDto, ['cnpj'] as const),
) {}
