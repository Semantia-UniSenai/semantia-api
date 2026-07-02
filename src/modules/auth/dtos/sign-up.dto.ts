import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../shared/enums/user-role.enum';

export class SignUpDto {
  @ApiProperty({ example: 'Ana Souza', description: 'Full display name' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'ana@semantia.app', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'sup3rsecret', minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @ApiProperty({
    required: false,
    enum: UserRole,
    enumName: 'UserRole',
    default: UserRole.ALUNO,
    description: 'Account role. Defaults to ALUNO when omitted.',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
