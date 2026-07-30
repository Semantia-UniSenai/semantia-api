import { Injectable } from '@nestjs/common';
import { RoomMemberRole } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import {
  Room,
  RoomMemberInfo,
  RoomParticipantRole,
  RoomSummary,
} from '../entities/room.entity';
import { CreateRoomData, RoomRepository } from './room.repository';

const memberRole = (
  role: RoomMemberRole,
): RoomParticipantRole.MODERATOR | RoomParticipantRole.PARTICIPANT =>
  role === RoomMemberRole.MODERATOR
    ? RoomParticipantRole.MODERATOR
    : RoomParticipantRole.PARTICIPANT;

@Injectable()
export class PrismaRoomRepository extends RoomRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateRoomData): Promise<Room> {
    return new Room(await this.prisma.room.create({ data }));
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { id } });
    return row ? new Room(row) : null;
  }

  async findByInviteCode(inviteCode: string): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { inviteCode } });
    return row ? new Room(row) : null;
  }

  async listAccessible(userId: string): Promise<RoomSummary[]> {
    const rows = await this.prisma.room.findMany({
      where: {
        OR: [{ hostId: userId }, { members: { some: { userId } } }],
      },
      include: {
        host: { select: { name: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map(
      ({ host, members, _count, ...row }) =>
        new RoomSummary({
          ...row,
          hostName: host.name,
          memberCount: _count.members,
          currentUserRole:
            row.hostId === userId
              ? RoomParticipantRole.HOST
              : memberRole(members[0].role),
        }),
    );
  }

  async findMembers(roomId: string): Promise<RoomMemberInfo[]> {
    const rows = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map(
      ({ user, ...row }) =>
        new RoomMemberInfo({
          userId: row.userId,
          name: user.name,
          email: user.email,
          role: memberRole(row.role),
          joinedAt: row.joinedAt,
        }),
    );
  }

  async getParticipantRole(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipantRole | null> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: {
        hostId: true,
        members: {
          where: { userId },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (!room) return null;
    if (room.hostId === userId) return RoomParticipantRole.HOST;
    return room.members[0] ? memberRole(room.members[0].role) : null;
  }

  async addMember(roomId: string, userId: string): Promise<void> {
    await this.prisma.roomMember.upsert({
      where: { roomId_userId: { roomId, userId } },
      create: { roomId, userId },
      update: {},
    });
  }

  async updateName(roomId: string, name: string): Promise<Room> {
    return new Room(
      await this.prisma.room.update({
        where: { id: roomId },
        data: { name },
      }),
    );
  }

  async updateMemberRole(
    roomId: string,
    userId: string,
    role: RoomParticipantRole.MODERATOR | RoomParticipantRole.PARTICIPANT,
  ): Promise<void> {
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: {
        role:
          role === RoomParticipantRole.MODERATOR
            ? RoomMemberRole.MODERATOR
            : RoomMemberRole.PARTICIPANT,
      },
    });
  }

  async removeMember(roomId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.roomMember.deleteMany({
      where: { roomId, userId },
    });
    return result.count > 0;
  }
}
