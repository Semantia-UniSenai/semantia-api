import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { generateInviteCode } from '../../../shared/utils/random-code.util';
import { CreateRoomDto } from '../dtos/room-write.dto';
import { Room } from '../entities/room.entity';
import { RoomRepository } from '../repositories/room.repository';

@Injectable()
export class CreateRoomUseCase {
  constructor(private readonly rooms: RoomRepository) {}

  async execute(actor: AuthUser, dto: CreateRoomDto): Promise<Room> {
    return this.rooms.create({
      name: dto.name.trim(),
      hostId: actor.userId,
      inviteCode: generateInviteCode(),
    });
  }
}
