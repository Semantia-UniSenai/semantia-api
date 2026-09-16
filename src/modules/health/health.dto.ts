import { ApiProperty } from '@nestjs/swagger';

export class TranscriptAdaptationHealthDto {
  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ enum: ['disabled', 'fake', 'groq'] })
  provider: 'disabled' | 'fake' | 'groq';

  @ApiProperty({ enum: ['disabled', 'ready', 'misconfigured'] })
  state: 'disabled' | 'ready' | 'misconfigured';

  @ApiProperty({ example: 'openai/gpt-oss-20b' })
  model: string;

  @ApiProperty({ example: 'pt-br-accessible-v1' })
  promptVersion: string;
}

export class HealthDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: true, description: 'True if SELECT 1 succeeded' })
  db: boolean;

  @ApiProperty({ type: TranscriptAdaptationHealthDto })
  transcriptAdaptation: TranscriptAdaptationHealthDto;
}
