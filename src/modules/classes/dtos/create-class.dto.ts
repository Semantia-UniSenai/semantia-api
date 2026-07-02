import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({
    example: 'Turma A — Informática 2026',
    description: 'Display name of the class',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}
