import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { Room } from '../entities/room.entity';
import { RoomPermissionService } from '../room-permission.service';
import { RoomRepository } from '../repositories/room.repository';

@Injectable()
export class UpdateRoomUseCase {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
  ) {}

  async execute(actor: AuthUser, roomId: string, name: string): Promise<Room> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    const role = await this.rooms.getParticipantRole(roomId, actor.userId);
    if (!this.permissions.canManage(role)) {
      throw new ForbiddenException(
        'Only a host or moderator can update the room',
      );
    }
    return this.rooms.updateName(roomId, name.trim());
  }
}
