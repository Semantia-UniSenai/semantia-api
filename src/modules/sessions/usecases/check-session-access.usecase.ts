import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { RoomSession, SessionStatus } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';

export interface SessionPrincipal {
  participantId: string;
  kind: 'account' | 'guest';
  sessionId?: string;
}

export interface SessionAccess {
  session: RoomSession;
  role: RoomParticipantRole;
  canManage: boolean;
}

@Injectable()
export class CheckSessionAccessUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
  ) {}

  async execute(
    principal: SessionPrincipal | null,
    sessionId: string,
    token?: string,
  ): Promise<SessionAccess> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    if (principal?.kind === 'account') {
      const role = await this.rooms.getParticipantRole(
        session.roomId,
        principal.participantId,
      );
      if (role) {
        const canManage = this.permissions.canManage(role);
        if (session.status === SessionStatus.PREPARING && !canManage) {
          throw new ForbiddenException('Session is still being prepared');
        }
        return {
          session,
          role,
          canManage,
        };
      }
    }

    if (
      (session.status === SessionStatus.LIVE ||
        session.status === SessionStatus.ENDED) &&
      principal?.kind === 'guest' &&
      principal.sessionId === session.id
    ) {
      return {
        session,
        role: RoomParticipantRole.GUEST,
        canManage: false,
      };
    }

    if (
      session.status === SessionStatus.LIVE &&
      token &&
      token === session.joinToken
    ) {
      return {
        session,
        role:
          principal?.kind === 'account'
            ? RoomParticipantRole.PARTICIPANT
            : RoomParticipantRole.GUEST,
        canManage: false,
      };
    }

    throw new ForbiddenException('You do not have access to this session');
  }
}
