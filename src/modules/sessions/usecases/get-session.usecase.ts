import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomSessionDetails } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';
import {
  CheckSessionAccessUseCase,
  SessionPrincipal,
} from './check-session-access.usecase';

@Injectable()
export class GetSessionUseCase {
  constructor(
    private readonly checkAccess: CheckSessionAccessUseCase,
    private readonly sessions: RoomSessionRepository,
  ) {}

  async execute(
    principal: SessionPrincipal | null,
    sessionId: string,
    token?: string,
  ): Promise<RoomSessionDetails> {
    const access = await this.checkAccess.execute(principal, sessionId, token);
    const details = await this.sessions.findDetailsById(sessionId);
    if (!details) throw new NotFoundException('Session not found');
    return access.canManage
      ? details
      : new RoomSessionDetails({ ...details, joinToken: '' });
  }
}
