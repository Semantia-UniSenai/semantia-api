import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SessionStatus } from '../entities/live-session.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import { LiveSessionRepository } from '../repositories/live-session.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';

export const MAX_TRANSCRIPT_SEGMENT_LENGTH = 5000;

/**
 * AppendTranscriptSegment — persists a finalized transcription chunk. Only
 * the owning teacher may write, and only while the session is LIVE. Used by
 * the gateway's `transcript:final` handler.
 */
@Injectable()
export class AppendTranscriptSegmentUseCase {
  constructor(
    private readonly sessions: LiveSessionRepository,
    private readonly transcripts: TranscriptRepository,
  ) {}

  async execute(
    actorUserId: string,
    sessionId: string,
    text: string,
  ): Promise<TranscriptSegment> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('Transcript text must not be empty');
    }
    if (trimmed.length > MAX_TRANSCRIPT_SEGMENT_LENGTH) {
      throw new BadRequestException('Transcript segment is too long');
    }

    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.teacherId !== actorUserId) {
      throw new ForbiddenException(
        'Only the owning teacher can publish the transcript',
      );
    }
    if (session.status !== SessionStatus.LIVE) {
      throw new ConflictException('Session has already ended');
    }

    return this.transcripts.append(sessionId, trimmed);
  }
}
