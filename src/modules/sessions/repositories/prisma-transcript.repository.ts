import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import { TranscriptRepository } from './transcript.repository';

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
  async append(sessionId: string, text: string): Promise<TranscriptSegment> {
    const row = await this.prisma.$transaction(async (tx) => {
      const agg = await tx.transcriptSegment.aggregate({
        where: { sessionId },
        _max: { seq: true },
      });
      return tx.transcriptSegment.create({
        data: { sessionId, seq: (agg._max.seq ?? 0) + 1, text },
      });
    });
    return new TranscriptSegment(row);
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
