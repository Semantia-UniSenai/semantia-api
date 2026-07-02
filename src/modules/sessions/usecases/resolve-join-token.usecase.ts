import { Injectable, NotFoundException } from '@nestjs/common';
import { ResolvedSessionDto } from '../dtos/session-response.dto';
import { LiveSessionRepository } from '../repositories/live-session.repository';

/**
 * ResolveJoinToken — turns a shared link token into the minimal session
 * pointer the frontend needs to route the user into the room.
 */
@Injectable()
export class ResolveJoinTokenUseCase {
  constructor(private readonly sessions: LiveSessionRepository) {}

  async execute(token: string): Promise<ResolvedSessionDto> {
    const session = await this.sessions.findByJoinToken(token);
    if (!session) {
      throw new NotFoundException('Invalid session token');
    }
    return {
      sessionId: session.id,
      title: session.title,
      status: session.status,
    };
  }
}
