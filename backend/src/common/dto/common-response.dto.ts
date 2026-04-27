import { ApiProperty } from '@nestjs/swagger';

export class OkResponseDto {
  @ApiProperty({ example: true })
  ok: boolean;
}

export class CountResponseDto {
  @ApiProperty({ example: 24 })
  count: number;
}

export class CreatedCountResponseDto {
  @ApiProperty({ example: 24 })
  created: number;
}

export class SignedUrlResponseDto {
  @ApiProperty({ example: 'https://storage.example.com/signed?token=...' })
  url: string;

  @ApiProperty({ example: 300 })
  expiresIn: number;
}
