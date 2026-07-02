import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatMessageWithAuthor } from '../entities/chat-message.entity';
import { LiveSessionDetails } from '../entities/live-session.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import { ChatMessageRepository } from '../repositories/chat-message.repository';
import { LiveSessionRepository } from '../repositories/live-session.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';

export const CHAT_HISTORY_LIMIT = 50;
export const TRANSCRIPT_TAIL_LIMIT = 30;

export interface SessionSnapshot {
  session: LiveSessionDetails;
  /** True when the requester is the owning teacher. */
  isOwner: boolean;
  /** Last N chat messages, oldest first. */
  chat: ChatMessageWithAuthor[];
  /** Last N finalized transcript segments, oldest first. */
  transcript: TranscriptSegment[];
}

/**
 * GetSessionSnapshot — everything a client needs to render the room right
 * after joining: session details, recent chat and the transcript tail.
 * Enforces the shared access rule (owner | class member | joinToken).
 */
@Injectable()
export class GetSessionSnapshotUseCase {
  constructor(
    private readonly checkAccess: CheckSessionAccessUseCase,
    private readonly sessions: LiveSessionRepository,
    private readonly messages: ChatMessageRepository,
    private readonly transcripts: TranscriptRepository,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    token?: string,
  ): Promise<SessionSnapshot> {
    const access = await this.checkAccess.execute(userId, sessionId, token);

    const [details, chat, transcript] = await Promise.all([
      this.sessions.findDetailsById(sessionId),
      this.messages.findLast(sessionId, CHAT_HISTORY_LIMIT),
      this.transcripts.findLast(sessionId, TRANSCRIPT_TAIL_LIMIT),
    ]);

    if (!details) {
      throw new NotFoundException('Session not found');
    }

    return { session: details, isOwner: access.isOwner, chat, transcript };
  }
}
