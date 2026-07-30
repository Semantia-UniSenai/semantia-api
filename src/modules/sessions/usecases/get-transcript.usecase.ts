import { Injectable } from '@nestjs/common';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import { TranscriptRepository } from '../repositories/transcript.repository';
import {
  CheckSessionAccessUseCase,
  SessionPrincipal,
} from './check-session-access.usecase';

@Injectable()
export class GetTranscriptUseCase {
  constructor(
    private readonly checkAccess: CheckSessionAccessUseCase,
    private readonly transcripts: TranscriptRepository,
  ) {}

  async execute(
    principal: SessionPrincipal | null,
    sessionId: string,
    token?: string,
  ): Promise<TranscriptSegment[]> {
    await this.checkAccess.execute(principal, sessionId, token);
    return this.transcripts.findBySession(sessionId);
  }
}
