import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { Room } from '../entities/room.entity';
import { RoomRepository } from '../repositories/room.repository';

@Injectable()
export class JoinRoomUseCase {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(actor: AuthUser, inviteCode: string): Promise<Room> {
    const room = await this.rooms.findByInviteCode(inviteCode.trim());
    if (!room) throw new NotFoundException('Invalid room invite code');
    if (room.hostId !== actor.userId) {
      await this.rooms.addMember(room.id, actor.userId);
    }
    return room;
  }
}
