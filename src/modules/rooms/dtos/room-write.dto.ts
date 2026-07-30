import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'Reunião de planejamento' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}

export class UpdateRoomDto {
  @ApiProperty({ example: 'Reunião geral de planejamento' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;
}
