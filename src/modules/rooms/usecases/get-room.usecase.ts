import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { RoomDetails } from '../entities/room.entity';
import { RoomRepository } from '../repositories/room.repository';

@Injectable()
export class GetRoomUseCase {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(actor: AuthUser, roomId: string): Promise<RoomDetails> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    const currentUserRole = await this.rooms.getParticipantRole(
      roomId,
      actor.userId,
    );
    if (!currentUserRole) {
      throw new ForbiddenException('You do not have access to this room');
    }
    const [members, summaries] = await Promise.all([
      this.rooms.findMembers(roomId),
      this.rooms.listAccessible(actor.userId),
    ]);
    const summary = summaries.find((candidate) => candidate.id === roomId);
    return new RoomDetails({
      ...room,
      hostName: summary?.hostName ?? '',
      currentUserRole,
      members,
    });
  }
}
