import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: true, description: 'True if SELECT 1 succeeded' })
  db: boolean;
}
