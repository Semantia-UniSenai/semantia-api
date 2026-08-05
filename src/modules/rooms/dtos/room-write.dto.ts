import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    example: 'Reunião de planejamento',
    required: false,
    description: 'Optional meeting name; instant meetings do not require setup',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;
}

export class UpdateRoomDto {
  @ApiProperty({ example: 'Reunião geral de planejamento' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}
