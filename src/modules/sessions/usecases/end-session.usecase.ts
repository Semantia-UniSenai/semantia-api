import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LiveSession, SessionStatus } from '../entities/live-session.entity';
import { LiveSessionRepository } from '../repositories/live-session.repository';

/**
 * EndSession — the owning teacher marks a session ENDED (sets endedAt).
 * Idempotent: ending an already-ended session returns it unchanged.
 */
@Injectable()
export class EndSessionUseCase {
  constructor(private readonly sessions: LiveSessionRepository) {}

  async execute(actorUserId: string, sessionId: string): Promise<LiveSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.teacherId !== actorUserId) {
      throw new ForbiddenException(
        'Only the owning teacher can end the session',
      );
    }

    if (session.status === SessionStatus.ENDED) {
      return session;
    }

    return this.sessions.end(sessionId, new Date());
  }
}
