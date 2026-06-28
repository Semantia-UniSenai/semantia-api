import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'ana@semantia.app', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'sup3rsecret', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
