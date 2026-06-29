import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RankingQueryDto {
  @ApiProperty({ example: 'fingerspelling', description: 'Game to rank' })
  @IsString()
  @MaxLength(64)
  gameKey: string;

  @ApiProperty({
    required: false,
    default: 20,
    example: 20,
    description: 'Max rows to return (1-100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class RankingEntryDto {
  @ApiProperty({ example: 1, description: '1-based position' })
  rank: number;

  @ApiProperty({ example: 'b3c1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  userId: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;

  @ApiProperty({ example: 1200, description: "User's best score for the game" })
  points: number;
}
