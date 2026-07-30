import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { RoomSession } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';

@Injectable()
export class ListRoomSessionsUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
  ) {}

  async execute(actor: AuthUser, roomId: string): Promise<RoomSession[]> {
    if (!(await this.rooms.findById(roomId))) {
      throw new NotFoundException('Room not found');
    }
    const role = await this.rooms.getParticipantRole(roomId, actor.userId);
    if (!role) {
      throw new ForbiddenException('You do not have access to this room');
    }
    const sessions = await this.sessions.findByRoom(roomId);
    if (this.permissions.canManage(role)) return sessions;
    return sessions.map(
      (session) => new RoomSession({ ...session, joinToken: '' }),
    );
  }
}
