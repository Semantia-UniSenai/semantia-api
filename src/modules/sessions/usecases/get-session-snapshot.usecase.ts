import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatMessage } from '../entities/chat-message.entity';
import { RoomSessionDetails } from '../entities/live-session.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import { ChatMessageRepository } from '../repositories/chat-message.repository';
import { RoomSessionRepository } from '../repositories/live-session.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';
import {
  CheckSessionAccessUseCase,
  SessionPrincipal,
} from './check-session-access.usecase';

export const CHAT_HISTORY_LIMIT = 50;
export const TRANSCRIPT_TAIL_LIMIT = 30;

export interface SessionSnapshot {
  session: RoomSessionDetails;
  role: import('../../rooms/entities/room.entity').RoomParticipantRole;
  canManage: boolean;
  chat: ChatMessage[];
  transcript: TranscriptSegment[];
}

@Injectable()
export class GetSessionSnapshotUseCase {
  constructor(
    private readonly checkAccess: CheckSessionAccessUseCase,
    private readonly sessions: RoomSessionRepository,
    private readonly messages: ChatMessageRepository,
    private readonly transcripts: TranscriptRepository,
  ) {}

  async execute(
    principal: SessionPrincipal,
    sessionId: string,
    token?: string,
  ): Promise<SessionSnapshot> {
    const access = await this.checkAccess.execute(principal, sessionId, token);
    const [details, chat, transcript] = await Promise.all([
      this.sessions.findDetailsById(sessionId),
      this.messages.findLast(sessionId, CHAT_HISTORY_LIMIT),
      this.transcripts.findLast(sessionId, TRANSCRIPT_TAIL_LIMIT),
    ]);
    if (!details) throw new NotFoundException('Session not found');
    return {
      session: access.canManage
        ? details
        : new RoomSessionDetails({ ...details, joinToken: '' }),
      role: access.role,
      canManage: access.canManage,
      chat,
      transcript,
    };
  }
}
