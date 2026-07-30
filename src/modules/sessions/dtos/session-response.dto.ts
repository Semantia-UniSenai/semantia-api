import { ApiProperty } from '@nestjs/swagger';
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

export class TranscriptSegmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty({ example: 3 })
  seq: number;

  @ApiProperty({ example: 'Vamos revisar as próximas entregas.' })
  text: string;

  @ApiProperty()
  createdAt: Date;
}
