import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { RoomParticipantRole } from '../entities/room.entity';
import { RoomRepository } from '../repositories/room.repository';

@Injectable()
export class UpdateRoomMemberRoleUseCase {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(
    actor: AuthUser,
    roomId: string,
    userId: string,
    role: RoomParticipantRole.MODERATOR | RoomParticipantRole.PARTICIPANT,
  ): Promise<void> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostId !== actor.userId) {
      throw new ForbiddenException('Only the host can assign room roles');
    }
    const targetRole = await this.rooms.getParticipantRole(roomId, userId);
    if (!targetRole || targetRole === RoomParticipantRole.HOST) {
      throw new NotFoundException('Room member not found');
    }
    await this.rooms.updateMemberRole(roomId, userId, role);
  }
}
