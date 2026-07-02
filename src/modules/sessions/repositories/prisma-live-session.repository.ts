import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  LiveSession,
  LiveSessionDetails,
  SessionStatus,
} from '../entities/live-session.entity';
import {
  CreateLiveSessionData,
  LiveSessionRepository,
} from './live-session.repository';

type SessionRow = {
  id: string;
  title: string;
  teacherId: string;
  classId: string | null;
  joinToken: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
};

const toEntity = (row: SessionRow): LiveSession =>
  new LiveSession({ ...row, status: row.status as SessionStatus });

/** Prisma-backed LiveSessionRepository. */
@Injectable()
export class PrismaLiveSessionRepository extends LiveSessionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateLiveSessionData): Promise<LiveSession> {
    const row = await this.prisma.liveSession.create({ data });
    return toEntity(row);
  }

  async findById(id: string): Promise<LiveSession | null> {
    const row = await this.prisma.liveSession.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findDetailsById(id: string): Promise<LiveSessionDetails | null> {
    const row = await this.prisma.liveSession.findUnique({
      where: { id },
      include: {
        teacher: { select: { name: true } },
        class: { select: { name: true } },
      },
    });
    if (!row) return null;
    const { teacher, class: schoolClass, ...session } = row;
    return new LiveSessionDetails({
      ...toEntity(session),
      teacherName: teacher.name,
      className: schoolClass?.name ?? null,
    });
  }

  async findByJoinToken(joinToken: string): Promise<LiveSession | null> {
    const row = await this.prisma.liveSession.findUnique({
      where: { joinToken },
    });
    return row ? toEntity(row) : null;
  }

  async findByClass(classId: string): Promise<LiveSession[]> {
    const rows = await this.prisma.liveSession.findMany({
      where: { classId },
      orderBy: { startedAt: 'desc' },
    });
    return rows.map(toEntity);
  }

  async end(id: string, endedAt: Date): Promise<LiveSession> {
    const row = await this.prisma.liveSession.update({
      where: { id },
      data: { status: 'ENDED', endedAt },
    });
    return toEntity(row);
  }
}
