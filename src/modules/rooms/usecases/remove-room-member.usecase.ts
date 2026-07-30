import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { RoomParticipantRole } from '../entities/room.entity';
import { RoomPermissionService } from '../room-permission.service';
import { RoomRepository } from '../repositories/room.repository';

@Injectable()
export class RemoveRoomMemberUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
  ) {}

  async execute(
    actor: AuthUser,
    roomId: string,
    userId: string,
  ): Promise<void> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    const actorRole = await this.rooms.getParticipantRole(roomId, actor.userId);
    if (!this.permissions.canManage(actorRole)) {
      throw new ForbiddenException(
        'Only a host or moderator can remove participants',
      );
    }
    const targetRole = await this.rooms.getParticipantRole(roomId, userId);
    if (!targetRole || targetRole === RoomParticipantRole.HOST) {
      throw new NotFoundException('Room member not found');
    }
    if (
      actorRole === RoomParticipantRole.MODERATOR &&
      targetRole === RoomParticipantRole.MODERATOR
    ) {
      throw new ForbiddenException(
        'A moderator cannot remove another moderator',
      );
    }
    if (!(await this.rooms.removeMember(roomId, userId))) {
      throw new NotFoundException('Room member not found');
    }
  }
}
