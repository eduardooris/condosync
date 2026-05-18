import { PartialType } from '@nestjs/swagger';
import { CreateCondominiumDto } from './create-condominium.dto';

/**
 * Permite editar todos os campos do `Create`, **com restrição lógica
 * sobre `cnpj`**: o service rejeita troca de um CPF/CNPJ existente por
 * outro (regra fiscal — uma mudança dessas deve ser uma operação
 * deliberada com auditoria, não um PATCH).
 *
 * O que é permitido:
 *   - condomínio sem cnpj (`null`) → adicionar CPF/CNPJ
 *   - condomínio com cnpj → limpar (`""` ou explicitamente null)
 *
 * O que é bloqueado:
 *   - trocar `12345678901` → `99999999999`
 *
 * O arquivamento é feito por `DELETE /condominiums/:id` (ou rota
 * dedicada de `unarchive`) para impedir que o subsíndico altere
 * `archivedAt` via PATCH e contorne RN-01.3.
 */
export class UpdateCondominiumDto extends PartialType(CreateCondominiumDto) {}
