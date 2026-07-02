import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    example: 'Aula 12 — Lógica de Programação',
    description: 'Title shown to students',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  @ApiProperty({
    required: false,
    nullable: true,
    format: 'uuid',
    description:
      'Class this session belongs to. Omit for an ad-hoc session joined only via link/token.',
  })
  @IsOptional()
  @IsUUID()
  classId?: string;
}
