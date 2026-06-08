import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * Endereço do titular para envio ao Asaas. Os 7 campos obrigatórios são
 * exigidos pelo Asaas (`POST /accounts` falha sem eles, desde 30/mai/2024).
 */
export class HolderAddressDto {
  @ApiProperty({ example: 'Av. Paulista' })
  @IsString()
  @Length(1, 200)
  street: string;

  @ApiProperty({ example: '1000' })
  @IsString()
  @Length(1, 20)
  number: string;

  @ApiPropertyOptional({ example: '5º andar, sala 502' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  complement?: string;

  @ApiProperty({ example: 'Bela Vista', description: 'Bairro.' })
  @IsString()
  @Length(1, 100)
  province: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiProperty({ example: 'SP', description: 'UF de 2 letras.' })
  @IsString()
  @Length(2, 2)
  state: string;

  @ApiProperty({ example: '01310100', description: 'Só dígitos.' })
  @Matches(/^\d{8}$/, {
    message: 'postalCode deve ter 8 dígitos (sem máscara).',
  })
  postalCode: string;
}
