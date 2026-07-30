import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InstantMeeting } from '../entities/instant-meeting.entity';
import { RoomSessionStatus } from '../entities/room.entity';
import {
  CreateInstantMeetingData,
  InstantMeetingRepository,
} from './instant-meeting.repository';

@Injectable()
export class PrismaInstantMeetingRepository extends InstantMeetingRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateInstantMeetingData): Promise<InstantMeeting> {
    const { room, meeting } = await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          name: data.name,
          hostId: data.hostId,
          inviteCode: data.inviteCode,
        },
      });
      const meeting = await tx.roomSession.create({
        data: {
          title: data.name,
          roomId: room.id,
          joinToken: data.joinToken,
          status: 'LIVE',
          startedAt: data.startedAt,
        },
      });
      return { room, meeting };
    });

    return new InstantMeeting({
      roomId: room.id,
      meetingId: meeting.id,
      name: room.name,
      joinToken: meeting.joinToken,
      status: RoomSessionStatus.LIVE,
      startedAt: meeting.startedAt ?? data.startedAt,
    });
  }
}
