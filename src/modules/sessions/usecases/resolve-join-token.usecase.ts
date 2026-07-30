import { Injectable, NotFoundException } from '@nestjs/common';
import {
  RoomSessionDetails,
  SessionStatus,
} from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';

export interface ResolvedSession {
  sessionId: string;
  title: string;
  roomId: string;
  roomName: string;
  status: SessionStatus;
}

@Injectable()
export class ResolveJoinTokenUseCase {
  constructor(private readonly sessions: RoomSessionRepository) {}

  async execute(token: string): Promise<ResolvedSession> {
    const session = await this.sessions.findByJoinToken(token);
    if (!session || session.status === SessionStatus.ENDED) {
      throw new NotFoundException('Invalid or expired session token');
    }
    const details: RoomSessionDetails | null =
      await this.sessions.findDetailsById(session.id);
    if (!details) throw new NotFoundException('Session not found');
    return {
      sessionId: details.id,
      title: details.title,
      roomId: details.roomId,
      roomName: details.roomName,
      status: details.status,
    };
  }
}
