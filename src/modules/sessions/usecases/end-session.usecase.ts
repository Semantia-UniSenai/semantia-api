import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { RoomSession, SessionStatus } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';

@Injectable()
export class EndSessionUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
  ) {}

  async execute(actorUserId: string, sessionId: string): Promise<RoomSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    const role = await this.rooms.getParticipantRole(
      session.roomId,
      actorUserId,
    );
    if (!this.permissions.canManage(role)) {
      throw new ForbiddenException(
        'Only a host or moderator can end the session',
      );
    }
    if (session.status === SessionStatus.ENDED) return session;
    return this.sessions.end(session.id, new Date());
  }
}
