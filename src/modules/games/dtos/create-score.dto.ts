import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScoreDto {
  @ApiProperty({
    example: 'fingerspelling',
    description:
      'Identifies the game. New games slot in without a schema change.',
  })
  @IsString()
  @MaxLength(64)
  gameKey: string;

  @ApiProperty({ example: 1200, description: 'Points earned in the session' })
  @IsInt()
  @Min(0)
  points: number;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 0.92,
    description: 'Accuracy ratio between 0 and 1',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  accuracy?: number;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 45000,
    description: 'Session duration in milliseconds',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  durationMs?: number;
}
