import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassRepository } from '../../classes/repositories/class.repository';
import { LiveSession } from '../entities/live-session.entity';
import { LiveSessionRepository } from '../repositories/live-session.repository';

export interface SessionAccess {
  session: LiveSession;
  /** True when the caller is the teacher who owns the session. */
  isOwner: boolean;
}

/**
 * CheckSessionAccess — THE single "can this user enter this session?" rule,
 * shared by the REST endpoints and the Socket.IO gateway. Access is granted
 * to: the owning teacher, a member of the session's class, or anyone
 * presenting the session's joinToken. Works for ENDED sessions too (read-only
 * transcript replay).
 */
@Injectable()
export class CheckSessionAccessUseCase {
  constructor(
    private readonly sessions: LiveSessionRepository,
    private readonly classes: ClassRepository,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    token?: string,
  ): Promise<SessionAccess> {
    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.teacherId === userId) {
      return { session, isOwner: true };
    }

    if (token && token === session.joinToken) {
      return { session, isOwner: false };
    }

    if (
      session.classId &&
      (await this.classes.isMember(session.classId, userId))
    ) {
      return { session, isOwner: false };
    }

    throw new ForbiddenException('You do not have access to this session');
  }
}
