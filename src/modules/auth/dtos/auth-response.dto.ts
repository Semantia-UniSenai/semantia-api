import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class UserDto {
  @ApiProperty({ example: 'b3c1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;

  @ApiProperty({ example: 'ana@semantia.app' })
  email: string;

  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    example: UserRole.ALUNO,
  })
  role: UserRole;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Signed JWT, send as Authorization: Bearer <token>',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
