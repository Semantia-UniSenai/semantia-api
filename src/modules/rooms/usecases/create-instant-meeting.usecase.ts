import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../shared/guards/jwt-auth.guard';
import {
  generateInviteCode,
  generateJoinToken,
} from '../../../shared/utils/random-code.util';
import { CreateRoomDto } from '../dtos/room-write.dto';
import { InstantMeeting } from '../entities/instant-meeting.entity';
import { InstantMeetingRepository } from '../repositories/instant-meeting.repository';

const DEFAULT_MEETING_NAME = 'Reunião instantânea';

@Injectable()
export class CreateInstantMeetingUseCase {
  constructor(private readonly meetings: InstantMeetingRepository) {}

  execute(actor: AuthUser, dto: CreateRoomDto): Promise<InstantMeeting> {
    const name = dto.name?.trim() || DEFAULT_MEETING_NAME;
    return this.meetings.create({
      name,
      hostId: actor.userId,
      inviteCode: generateInviteCode(),
      joinToken: generateJoinToken(),
      startedAt: new Date(),
    });
  }
}
