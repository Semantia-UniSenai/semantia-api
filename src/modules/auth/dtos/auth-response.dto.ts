import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;

  @ApiProperty({ example: 'ana@semantia.app' })
  email: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Signed JWT, send as Authorization: Bearer ***',
    example: 'eyJhbG...VCJ9...',
  })
  accessToken: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
