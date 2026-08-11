import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AudienceContext } from '../../sessions/entities/audience-context.entity';
import {
  TranscriptAdaptation,
  TranscriptAdaptationFailureCode,
  TranscriptAdaptationStatus,
} from '../entities/transcript-adaptation.entity';
import {
  CompleteAdaptationFailureData,
  CompleteAdaptationSuccessData,
  CreatePendingAdaptationData,
  TranscriptAdaptationRepository,
} from './transcript-adaptation.repository';

type AdaptationRow = {
  id: string;
  transcriptSegmentId: string;
  text: string | null;
  status: string;
  failureCode: string | null;
  contextVersion: number;
  contextSnapshot: unknown;
  promptVersion: string;
  provider: string;
  model: string;
  latencyMs: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

const toEntity = (row: AdaptationRow): TranscriptAdaptation =>
  new TranscriptAdaptation({
    ...row,
    status: row.status as TranscriptAdaptation['status'],
    failureCode:
      (row.failureCode as TranscriptAdaptation['failureCode']) ?? null,
    contextSnapshot: row.contextSnapshot as AudienceContext,
  });

@Injectable()
export class PrismaTranscriptAdaptationRepository extends TranscriptAdaptationRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createPending(
    data: CreatePendingAdaptationData,
  ): Promise<TranscriptAdaptation> {
    return toEntity(
      await this.prisma.transcriptAdaptation.upsert({
        where: { transcriptSegmentId: data.transcriptSegmentId },
        create: {
          ...data,
          contextSnapshot: { ...data.contextSnapshot },
        },
        update: {},
      }),
    );
  }

  async findBySegmentId(
    transcriptSegmentId: string,
  ): Promise<TranscriptAdaptation | null> {
    const row = await this.prisma.transcriptAdaptation.findUnique({
      where: { transcriptSegmentId },
    });
    return row ? toEntity(row) : null;
  }

  async completeSuccess(
    transcriptSegmentId: string,
    data: CompleteAdaptationSuccessData,
  ): Promise<TranscriptAdaptation> {
    await this.prisma.transcriptAdaptation.updateMany({
      where: {
        transcriptSegmentId,
        status: TranscriptAdaptationStatus.PENDING,
      },
      data: {
        status: TranscriptAdaptationStatus.SUCCEEDED,
        text: data.text,
        failureCode: null,
        latencyMs: data.latencyMs,
        inputTokens: data.inputTokens ?? null,
        cachedInputTokens: data.cachedInputTokens ?? null,
        outputTokens: data.outputTokens ?? null,
        attemptCount: data.attemptCount,
        completedAt: data.completedAt,
      },
    });
    return toEntity(
      await this.prisma.transcriptAdaptation.findUniqueOrThrow({
        where: { transcriptSegmentId },
      }),
    );
  }

  async completeFailure(
    transcriptSegmentId: string,
    data: CompleteAdaptationFailureData,
  ): Promise<TranscriptAdaptation> {
    await this.prisma.transcriptAdaptation.updateMany({
      where: {
        transcriptSegmentId,
        status: TranscriptAdaptationStatus.PENDING,
      },
      data: {
        status: data.status,
        failureCode: data.failureCode,
        latencyMs: data.latencyMs ?? null,
        inputTokens: data.inputTokens ?? null,
        cachedInputTokens: data.cachedInputTokens ?? null,
        outputTokens: data.outputTokens ?? null,
        attemptCount: data.attemptCount,
        completedAt: data.completedAt,
      },
    });
    return toEntity(
      await this.prisma.transcriptAdaptation.findUniqueOrThrow({
        where: { transcriptSegmentId },
      }),
    );
  }

  async markStalePendingAsFallback(staleBefore: Date): Promise<number> {
    const result = await this.prisma.transcriptAdaptation.updateMany({
      where: {
        status: TranscriptAdaptationStatus.PENDING,
        createdAt: { lt: staleBefore },
      },
      data: {
        status: TranscriptAdaptationStatus.FALLBACK,
        failureCode: TranscriptAdaptationFailureCode.PROCESS_INTERRUPTED,
        completedAt: new Date(),
      },
    });
    return result.count;
  }
}
