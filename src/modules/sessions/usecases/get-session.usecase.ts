import { Injectable, NotFoundException } from '@nestjs/common';
import { LiveSessionDetails } from '../entities/live-session.entity';
import { LiveSessionRepository } from '../repositories/live-session.repository';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';

/**
 * GetSession — session info (title, status, teacher, class) for anyone the
 * shared access rule lets in: owner, class member, or joinToken bearer.
 */
@Injectable()
export class GetSessionUseCase {
  constructor(
    private readonly sessions: LiveSessionRepository,
    private readonly checkAccess: CheckSessionAccessUseCase,
  ) {}

  async execute(
    userId: string,
    sessionId: string,
    token?: string,
  ): Promise<LiveSessionDetails> {
    await this.checkAccess.execute(userId, sessionId, token);

    const details = await this.sessions.findDetailsById(sessionId);
    if (!details) {
      throw new NotFoundException('Session not found');
    }
    return details;
  }
}
