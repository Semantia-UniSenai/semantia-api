import type { AudienceContext } from '../../sessions/entities/audience-context.entity';
import {
  TranscriptAdaptation,
  TranscriptAdaptationFailureCode,
  TranscriptAdaptationStatus,
} from '../entities/transcript-adaptation.entity';

export type CreatePendingAdaptationData = {
  transcriptSegmentId: string;
  contextVersion: number;
  contextSnapshot: AudienceContext | null;
  promptVersion: string;
  provider: string;
  model: string;
};

export type CompleteAdaptationSuccessData = {
  text: string;
  latencyMs: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  attemptCount: number;
  completedAt: Date;
};

export type CompleteAdaptationFailureData = {
  status:
    | typeof TranscriptAdaptationStatus.FALLBACK
    | typeof TranscriptAdaptationStatus.BYPASSED;
  failureCode: TranscriptAdaptationFailureCode;
  latencyMs?: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  attemptCount: number;
  completedAt: Date;
};

export abstract class TranscriptAdaptationRepository {
  abstract createPending(
    data: CreatePendingAdaptationData,
  ): Promise<TranscriptAdaptation>;
  abstract findBySegmentId(
    transcriptSegmentId: string,
  ): Promise<TranscriptAdaptation | null>;
  abstract completeSuccess(
    transcriptSegmentId: string,
    data: CompleteAdaptationSuccessData,
  ): Promise<TranscriptAdaptation>;
  abstract completeFailure(
    transcriptSegmentId: string,
    data: CompleteAdaptationFailureData,
  ): Promise<TranscriptAdaptation>;
  abstract markStalePendingAsFallback(staleBefore: Date): Promise<number>;
}
