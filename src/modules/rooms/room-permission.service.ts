import { Injectable } from '@nestjs/common';
import { RoomParticipantRole } from './entities/room.entity';

@Injectable()
export class RoomPermissionService {
  canManage(role: RoomParticipantRole | null): boolean {
    return (
      role === RoomParticipantRole.HOST ||
      role === RoomParticipantRole.MODERATOR
    );
  }
}
