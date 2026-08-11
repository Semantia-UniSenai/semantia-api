import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import {
  AppendTranscriptResult,
  TranscriptRepository,
} from './transcript.repository';

type AdaptationRow = {
  text: string | null;
  status: string;
  failureCode: string | null;
  contextVersion: number;
  promptVersion: string;
  provider: string;
  model: string;
  updatedAt: Date;
  completedAt: Date | null;
};

type TranscriptRow = Omit<
  ConstructorParameters<typeof TranscriptSegment>[0],
  'adaptation'
> & {
  adaptation?: AdaptationRow | null;
};

const toEntity = (row: TranscriptRow): TranscriptSegment => {
  const adaptation = row.adaptation;
  return new TranscriptSegment({
    ...row,
    adaptation:
      adaptation && adaptation.status !== 'PENDING'
        ? {
            text: adaptation.text ?? row.text,
            status:
              adaptation.status === 'SUCCEEDED'
                ? 'succeeded'
                : adaptation.status === 'BYPASSED'
                  ? 'bypassed'
                  : 'fallback',
            failureCode: adaptation.failureCode,
            automatic: true,
            contextVersion: adaptation.contextVersion,
            promptVersion: adaptation.promptVersion,
            provider: adaptation.provider,
            model: adaptation.model,
            at: adaptation.completedAt ?? adaptation.updatedAt,
          }
        : null,
  });
};

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
    cleaningStrategyVersion: string,
  ): Promise<AppendTranscriptResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.prisma.transcriptSegment.findUnique({
        where: { sessionId_clientSegmentId: { sessionId, clientSegmentId } },
      });
      if (existing) {
        return { segment: toEntity(existing), created: false };
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
              cleaningStrategyVersion,
            },
          });
        });
        return { segment: toEntity(row), created: true };
      } catch (error) {
        if (!this.isUniqueConflict(error)) throw error;
      }
    }

    const existing = await this.prisma.transcriptSegment.findUnique({
      where: { sessionId_clientSegmentId: { sessionId, clientSegmentId } },
    });
    if (existing) {
      return { segment: toEntity(existing), created: false };
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
      include: { adaptation: true },
    });
    return row ? toEntity(row) : null;
  }

  async findBySession(sessionId: string): Promise<TranscriptSegment[]> {
    const rows = await this.prisma.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { seq: 'asc' },
      include: { adaptation: true },
    });
    return rows.map(toEntity);
  }

  async findLast(
    sessionId: string,
    limit: number,
  ): Promise<TranscriptSegment[]> {
    const rows = await this.prisma.transcriptSegment.findMany({
      where: { sessionId },
      orderBy: { seq: 'desc' },
      take: limit,
      include: { adaptation: true },
    });
    return rows.reverse().map(toEntity);
  }
}
