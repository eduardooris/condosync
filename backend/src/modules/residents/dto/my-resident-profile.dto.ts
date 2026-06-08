import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MyResidentProfileResponseDto {
  @ApiProperty({
    example: '7e6c5b4a-3d2c-4e1f-9a0b-c8d7e6f5a4b3',
    description: 'Identificador do cadastro do morador.',
  })
  id: string;

  @ApiProperty({
    example: '82f1c46f-f7f7-4f9e-82cb-cbd38341f5f0',
    description: 'Unidade vinculada ao morador no condomínio ativo.',
  })
  unitId: string;

  @ApiProperty({
    example: 'Maria da Silva',
    description: 'Nome do morador vinculado à unidade.',
  })
  fullName: string;

  @ApiProperty({
    example: '5581999999999',
    description:
      'WhatsApp cadastrado no morador (usado no vínculo da unidade).',
  })
  phoneWhatsapp: string;

  @ApiProperty({
    example: true,
    description: 'Indica se o morador é o responsável financeiro da unidade.',
  })
  isFinancialResponsible: boolean;

  @ApiProperty({ example: 'A', description: 'Bloco da unidade vinculada.' })
  block: string;

  @ApiProperty({
    example: '101',
    description: 'Número/apto da unidade vinculada.',
  })
  number: string;
}

export class UpdateMyResidentProfileDto {
  @ApiProperty({
    example: 'Maria da Silva',
    required: false,
    description: 'Nome do morador no contexto da unidade.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @ApiProperty({
    example: '11987654321',
    required: false,
    description:
      'WhatsApp do morador no contexto da unidade (DDD + número, com DDI opcional).',
  })
  @IsOptional()
  @IsString()
  phoneWhatsapp?: string;
}
