import { Injectable } from '@nestjs/common';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import { TranscriptRepository } from '../repositories/transcript.repository';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';

/**
 * GetTranscript — full transcript ordered by seq. Same access rule as the
 * session itself, and it works after the session ended so students can
 * re-read the whole lesson.
 */
@Injectable()
export class GetTranscriptUseCase {
  constructor(
    private readonly transcripts: TranscriptRepository,
    private readonly checkAccess: CheckSessionAccessUseCase,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    token?: string,
  ): Promise<TranscriptSegment[]> {
    await this.checkAccess.execute(userId, sessionId, token);
    return this.transcripts.findBySession(sessionId);
  }
}
