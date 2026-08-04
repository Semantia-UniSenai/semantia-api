import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import {
  AppendTranscriptResult,
  TranscriptRepository,
} from './transcript.repository';

/** Prisma-backed TranscriptRepository. */
@Injectable()
export class PrismaTranscriptRepository extends TranscriptRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Appends a segment with the next per-session seq. The max+1 read and the
   * insert run in one transaction; with a single writer per session (the
   * teacher's gateway connection) this keeps seq gapless and ordered.
   */
  async append(
    sessionId: string,
    text: string,
    clientSegmentId: string,
  ): Promise<AppendTranscriptResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.prisma.transcriptSegment.findUnique({
        where: { sessionId_clientSegmentId: { sessionId, clientSegmentId } },
      });
      if (existing) {
        return { segment: new TranscriptSegment(existing), created: false };
      }

      try {
        const row = await this.prisma.$transaction(async (tx) => {
          const agg = await tx.transcriptSegment.aggregate({
            where: { sessionId },
            _max: { seq: true },
          });
          return tx.transcriptSegment.create({
            data: {
              sessionId,
              clientSegmentId,
              seq: (agg._max.seq ?? 0) + 1,
              text,
            },
          });
        });
        return { segment: new TranscriptSegment(row), created: true };
      } catch (error) {
        if (!this.isUniqueConflict(error)) throw error;
      }
    }

    const existing = await this.prisma.transcriptSegment.findUnique({
      where: { sessionId_clientSegmentId: { sessionId, clientSegmentId } },
    });
    if (existing) {
      return { segment: new TranscriptSegment(existing), created: false };
    }
    throw new Error('Could not allocate transcript sequence');
  }

  private isUniqueConflict(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  async findByClientSegmentId(
    sessionId: string,
    clientSegmentId: string,
  ): Promise<TranscriptSegment | null> {
    const row = await this.prisma.transcriptSegment.findUnique({
      where: { sessionId_clientSegmentId: { sessionId, clientSegmentId } },
    });
    return row ? new TranscriptSegment(row) : null;
  }

  async findBySession(sessionId: string): Promise<TranscriptSegment[]> {
    const rows = await this.prisma.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { seq: 'asc' },
    });
    return rows.map((r) => new TranscriptSegment(r));
  }

  async findLast(
    sessionId: string,
    limit: number,
  ): Promise<TranscriptSegment[]> {
    const rows = await this.prisma.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { seq: 'desc' },
      take: limit,
    });
    return rows.reverse().map((r) => new TranscriptSegment(r));
  }
}
