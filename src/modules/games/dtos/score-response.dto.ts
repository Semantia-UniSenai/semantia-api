import { ApiProperty } from '@nestjs/swagger';

export class ScoreDto {
  @ApiProperty({ example: 'b3c1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'b3c1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  userId: string;

  @ApiProperty({ example: 'fingerspelling' })
  gameKey: string;

  @ApiProperty({ example: 1200 })
  points: number;

  @ApiProperty({ nullable: true, example: 0.92, type: Number })
  accuracy: number | null;

  @ApiProperty({ nullable: true, example: 45000, type: Number })
  durationMs: number | null;

  @ApiProperty({ example: '2026-06-28T18:00:00.000Z' })
  createdAt: Date;
}
