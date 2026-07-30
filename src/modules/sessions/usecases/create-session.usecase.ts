import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import { generateJoinToken } from '../../../shared/utils/random-code.util';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { CreateSessionDto } from '../dtos/create-session.dto';
import { RoomSession } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';

@Injectable()
export class CreateSessionUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
  ) {}

  async execute(
    actor: AuthUser,
    roomId: string,
    dto: CreateSessionDto,
  ): Promise<RoomSession> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new NotFoundException('Room not found');
    const role = await this.rooms.getParticipantRole(roomId, actor.userId);
    if (!this.permissions.canManage(role)) {
      throw new ForbiddenException(
        'Only a host or moderator can create sessions',
      );
    }
    return this.sessions.create({
      title: dto.title.trim(),
      roomId,
      joinToken: generateJoinToken(),
    });
  }
}
