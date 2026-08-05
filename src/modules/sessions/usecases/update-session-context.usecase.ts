import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { AudienceContext } from '../entities/audience-context.entity';
import { RoomSession, SessionStatus } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';

@Injectable()
export class UpdateSessionContextUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
  ) {}

  async execute(
    actorUserId: string,
    sessionId: string,
    context: AudienceContext,
  ): Promise<RoomSession> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    const role = await this.rooms.getParticipantRole(
      session.roomId,
      actorUserId,
    );
    if (!this.permissions.canManage(role)) {
      throw new ForbiddenException(
        'Only a host or moderator can configure the session context',
      );
    }

    if (session.status !== SessionStatus.PREPARING) {
      throw new ConflictException(
        'Context cannot be changed after the session has started',
      );
    }

    return this.sessions.updateAudienceContext(sessionId, context);
  }
}
