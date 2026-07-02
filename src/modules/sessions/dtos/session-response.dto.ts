import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '../entities/live-session.entity';

export class SessionDto {
  @ApiProperty({ example: 's3a1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'Aula 12 — Lógica de Programação' })
  title: string;

  @ApiProperty({ example: 'b3c1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  teacherId: string;

  @ApiProperty({ nullable: true, example: null })
  classId: string | null;

  @ApiProperty({
    example: 'Xk3nP9qLmT7vB2cD',
    description: 'Opaque token that grants access via link (?token=...)',
  })
  joinToken: string;

  @ApiProperty({
    enum: SessionStatus,
    enumName: 'SessionStatus',
    example: SessionStatus.LIVE,
  })
  status: SessionStatus;

  @ApiProperty({ example: '2026-07-01T12:00:00.000Z' })
  startedAt: Date;

  @ApiProperty({ nullable: true, example: null })
  endedAt: Date | null;
}

export class SessionDetailDto extends SessionDto {
  @ApiProperty({ example: 'Carlos Lima' })
  teacherName: string;

  @ApiProperty({ nullable: true, example: 'Turma A — Informática 2026' })
  className: string | null;
}

export class ResolvedSessionDto {
  @ApiProperty({ example: 's3a1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  sessionId: string;

  @ApiProperty({ example: 'Aula 12 — Lógica de Programação' })
  title: string;

  @ApiProperty({
    enum: SessionStatus,
    enumName: 'SessionStatus',
    example: SessionStatus.LIVE,
  })
  status: SessionStatus;
}

export class TranscriptSegmentDto {
  @ApiProperty({ example: 't3a1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 's3a1f0a2-1d2e-4a5b-8c9d-0e1f2a3b4c5d' })
  sessionId: string;

  @ApiProperty({ example: 3, description: 'Monotonic order within a session' })
  seq: number;

  @ApiProperty({ example: 'Hoje vamos falar sobre estruturas de repetição.' })
  text: string;

  @ApiProperty({ example: '2026-07-01T12:00:00.000Z' })
  createdAt: Date;
}
