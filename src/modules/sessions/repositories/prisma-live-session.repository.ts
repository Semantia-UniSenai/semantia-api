import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AudienceContext } from '../entities/audience-context.entity';
import {
  RoomSession,
  RoomSessionDetails,
  SessionStatus,
} from '../entities/live-session.entity';
import {
  CreateRoomSessionData,
  RoomSessionRepository,
  SessionSettingsUpdate,
} from './live-session.repository';

type SessionRow = {
  id: string;
  title: string;
  roomId: string;
  joinToken: string;
  status: string;
  requiresApproval: boolean;
  audienceContext: unknown;
  audienceContextVersion: number;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
};

const toEntity = (row: SessionRow): RoomSession =>
  new RoomSession({
    ...row,
    status: row.status as SessionStatus,
    audienceContext: (row.audienceContext as AudienceContext) ?? null,
  });

@Injectable()
export class PrismaRoomSessionRepository extends RoomSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateRoomSessionData): Promise<RoomSession> {
    return toEntity(await this.prisma.roomSession.create({ data }));
  }

  async findById(id: string): Promise<RoomSession | null> {
    const row = await this.prisma.roomSession.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findDetailsById(id: string): Promise<RoomSessionDetails | null> {
    const row = await this.prisma.roomSession.findUnique({
      where: { id },
      include: {
        room: { include: { host: { select: { name: true } } } },
      },
    });
    if (!row) return null;
    const { room, ...session } = row;
    return new RoomSessionDetails({
      ...toEntity(session),
      roomName: room.name,
      hostId: room.hostId,
      hostName: room.host.name,
    });
  }

  async findByJoinToken(joinToken: string): Promise<RoomSession | null> {
    const row = await this.prisma.roomSession.findUnique({
      where: { joinToken },
    });
    return row ? toEntity(row) : null;
  }

  async findByRoom(roomId: string): Promise<RoomSession[]> {
    const rows = await this.prisma.roomSession.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toEntity);
  }

  async start(id: string, startedAt: Date): Promise<RoomSession> {
    return toEntity(
      await this.prisma.roomSession.update({
        where: { id },
        data: { status: 'LIVE', startedAt },
      }),
    );
  }

  async end(id: string, endedAt: Date): Promise<RoomSession> {
    return toEntity(
      await this.prisma.roomSession.update({
        where: { id },
        data: { status: 'ENDED', endedAt },
      }),
    );
  }

  async updateAudienceContext(
    id: string,
    context: AudienceContext,
  ): Promise<RoomSession> {
    return toEntity(
      await this.prisma.roomSession.update({
        where: { id },
        data: {
          audienceContext: { ...context },
          audienceContextVersion: { increment: 1 },
        },
      }),
    );
  }

  async updateSettings(
    id: string,
    settings: SessionSettingsUpdate,
  ): Promise<RoomSession> {
    const data: Record<string, unknown> = {};
    if (settings.audienceContext !== undefined) {
      data.audienceContext = settings.audienceContext;
      data.audienceContextVersion = { increment: 1 };
    }
    if (settings.requiresApproval !== undefined) {
      data.requiresApproval = settings.requiresApproval;
    }
    return toEntity(
      await this.prisma.roomSession.update({ where: { id }, data }),
    );
  }
}
