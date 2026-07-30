import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    example: 'Reunião semanal',
    description: 'Title shown to every participant',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;
}
