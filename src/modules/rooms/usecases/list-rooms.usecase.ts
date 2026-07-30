import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { RoomSummary } from '../entities/room.entity';
import { RoomRepository } from '../repositories/room.repository';

@Injectable()
export class ListRoomsUseCase {
  constructor(private readonly rooms: RoomRepository) {}

  execute(actor: AuthUser): Promise<RoomSummary[]> {
    return this.rooms.listAccessible(actor.userId);
  }
}
