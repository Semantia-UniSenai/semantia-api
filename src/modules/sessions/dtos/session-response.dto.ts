import { ApiProperty } from '@nestjs/swagger';
import { AudienceContextDto } from './audience-context.dto';
import { SessionStatus } from '../entities/live-session.entity';

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Reunião semanal' })
  title: string;

  @ApiProperty({ format: 'uuid' })
  roomId: string;

  @ApiProperty({ description: 'Opaque capability token for this session' })
  joinToken: string;

  @ApiProperty({ enum: SessionStatus, enumName: 'SessionStatus' })
  status: SessionStatus;

  @ApiProperty({ type: AudienceContextDto, nullable: true })
  audienceContext: AudienceContextDto | null;

  @ApiProperty({
    example: 0,
    description: 'Monotonic version of the persisted audience context',
  })
  audienceContextVersion: number;

  @ApiProperty({
    description: 'Whether new participants require host approval',
  })
  requiresApproval: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true })
  startedAt: Date | null;

  @ApiProperty({ nullable: true })
  endedAt: Date | null;
}

export class SessionDetailDto extends SessionDto {
  @ApiProperty({ example: 'Planejamento da equipe' })
  roomName: string;

  @ApiProperty({ format: 'uuid' })
  hostId: string;

  @ApiProperty({ example: 'Ana Souza' })
  hostName: string;
}

export class ResolvedSessionDto {
  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  roomId: string;

  @ApiProperty({ example: 'Reunião semanal' })
  title: string;

  @ApiProperty({ example: 'Planejamento da equipe' })
  roomName: string;

  @ApiProperty({ enum: SessionStatus, enumName: 'SessionStatus' })
  status: SessionStatus;
}

export class TranscriptSegmentAdaptationDto {
  @ApiProperty({ example: 'Vamos revisar as entregas seguintes.' })
  text: string;

  @ApiProperty({ enum: ['succeeded', 'fallback', 'bypassed'] })
  status: 'succeeded' | 'fallback' | 'bypassed';

  @ApiProperty({ nullable: true, example: null })
  failureCode: string | null;

  @ApiProperty({ example: true })
  automatic: true;

  @ApiProperty({ example: 2 })
  contextVersion: number;

  @ApiProperty({ example: 'pt-br-accessible-v2' })
  promptVersion: string;

  @ApiProperty({ example: 'groq' })
  provider: string;

  @ApiProperty({ example: 'openai/gpt-oss-20b' })
  model: string;

  @ApiProperty()
  at: Date;
}

export class TranscriptSegmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 3 })
  seq: number;

  @ApiProperty({ example: 'Vamos revisar as próximas entregas.' })
  text: string;

  @ApiProperty({ example: 'pt-br-conservative-v1' })
  cleaningStrategyVersion: string;

  @ApiProperty({
    type: TranscriptSegmentAdaptationDto,
    nullable: true,
    required: false,
  })
  adaptation?: TranscriptSegmentAdaptationDto | null;

  @ApiProperty()
  createdAt: Date;
}
