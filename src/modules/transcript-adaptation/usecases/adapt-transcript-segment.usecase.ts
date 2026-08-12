import { Injectable } from '@nestjs/common';
import type { AudienceContext } from '../../sessions/entities/audience-context.entity';
import { TranscriptSegment } from '../../sessions/entities/transcript-segment.entity';
import { TranscriptAdaptationRuntimeConfig } from '../config/transcript-adaptation.config';
import {
  TranscriptAdaptation,
  TranscriptAdaptationFailureCode,
  TranscriptAdaptationStatus,
} from '../entities/transcript-adaptation.entity';
import {
  TranscriptAdaptationProvider,
  TranscriptAdaptationProviderError,
  TranscriptAdaptationRetryError,
} from '../providers/transcript-adaptation.provider';
import { AdaptationCircuitBreaker } from '../resilience/circuit-breaker';
import { executeAdaptationWithRetry } from '../resilience/adaptation-retry';
import { TranscriptAdaptationRepository } from '../repositories/transcript-adaptation.repository';
import { detectHighRiskContent } from '../validation/high-risk-content.detector';
import { validateSemanticPreservation } from '../validation/semantic-preservation.validator';

export type AdaptTranscriptSegmentInput = {
  segment: TranscriptSegment;
  context: AudienceContext | null;
  contextVersion: number;
};

export type PublicTranscriptAdaptationStatus =
  'succeeded' | 'fallback' | 'bypassed';

export type TranscriptAdaptedEvent = {
  segmentId: string;
  sessionId: string;
  seq: number;
  adaptation: {
    text: string;
    status: PublicTranscriptAdaptationStatus;
    failureCode: TranscriptAdaptationFailureCode | null;
    automatic: true;
    contextVersion: number;
    promptVersion: string;
    provider: string;
    model: string;
    at: Date;
  };
};

export type AdaptTranscriptSegmentResult = {
  adaptation: TranscriptAdaptation;
  event: TranscriptAdaptedEvent;
};

const failureCodeByProviderError: Record<
  string,
  TranscriptAdaptationFailureCode
> = {
  DISABLED: TranscriptAdaptationFailureCode.DISABLED,
  MISCONFIGURED: TranscriptAdaptationFailureCode.MISCONFIGURED,
  TIMEOUT: TranscriptAdaptationFailureCode.TIMEOUT,
  RATE_LIMIT: TranscriptAdaptationFailureCode.RATE_LIMIT,
  CAPACITY: TranscriptAdaptationFailureCode.CAPACITY,
  CIRCUIT_OPEN: TranscriptAdaptationFailureCode.CIRCUIT_OPEN,
  PROVIDER_ERROR: TranscriptAdaptationFailureCode.PROVIDER_ERROR,
  INVALID_RESPONSE: TranscriptAdaptationFailureCode.INVALID_RESPONSE,
};

@Injectable()
export class AdaptTranscriptSegmentUseCase {
  constructor(
    private readonly adaptations: TranscriptAdaptationRepository,
    private readonly provider: TranscriptAdaptationProvider,
    private readonly config: TranscriptAdaptationRuntimeConfig,
    private readonly circuit: AdaptationCircuitBreaker,
  ) {}

  async execute(
    input: AdaptTranscriptSegmentInput,
  ): Promise<AdaptTranscriptSegmentResult> {
    const existing = await this.adaptations.findBySegmentId(input.segment.id);
    if (existing && existing.status !== TranscriptAdaptationStatus.PENDING) {
      return this.toResult(input.segment, existing);
    }

    const adaptation =
      existing ??
      (await this.adaptations.createPending({
        transcriptSegmentId: input.segment.id,
        contextVersion: input.contextVersion,
        contextSnapshot: input.context,
        promptVersion: this.config.promptVersion,
        provider: this.provider.providerName,
        model: this.provider.modelName,
      }));
    if (adaptation.status !== TranscriptAdaptationStatus.PENDING) {
      return this.toResult(input.segment, adaptation);
    }

    if (this.config.toPublicState().state === 'disabled') {
      return this.completeBypass(
        input.segment,
        TranscriptAdaptationFailureCode.DISABLED,
      );
    }

    if (!input.context) {
      return this.completeBypass(
        input.segment,
        TranscriptAdaptationFailureCode.NO_CONTEXT,
      );
    }

    if (detectHighRiskContent(input.segment.text).highRisk) {
      return this.completeBypass(
        input.segment,
        TranscriptAdaptationFailureCode.HIGH_RISK,
      );
    }

    const startedAt = Date.now();
    try {
      const execution = await this.circuit.execute(() =>
        executeAdaptationWithRetry(
          (signal) =>
            this.provider.adapt(
              {
                literalText: input.segment.text,
                language: 'pt-BR',
                contextVersion: input.contextVersion,
                context: input.context as AudienceContext,
                promptVersion: this.config.promptVersion,
              },
              signal,
            ),
          {
            timeoutMs: this.config.timeoutMs,
            maxRetries: this.config.maxRetries,
          },
        ),
      );
      const { output, usage } = execution.result;
      if (output.risk === 'urgent') {
        return this.completeBypass(
          input.segment,
          TranscriptAdaptationFailureCode.HIGH_RISK,
          execution.attemptCount,
          Date.now() - startedAt,
          usage,
        );
      }
      const preservation = validateSemanticPreservation(
        input.segment.text,
        output.adaptedText,
        output.decision,
      );
      if (!preservation.valid) {
        return this.completeFallback(
          input.segment,
          TranscriptAdaptationFailureCode.PRESERVATION_FAILED,
          execution.attemptCount,
          Date.now() - startedAt,
          usage,
        );
      }

      const completedAt = new Date();
      const completed = await this.adaptations.completeSuccess(
        input.segment.id,
        {
          text: output.adaptedText,
          latencyMs: Date.now() - startedAt,
          inputTokens: usage.inputTokens ?? undefined,
          cachedInputTokens: usage.cachedInputTokens ?? undefined,
          outputTokens: usage.outputTokens ?? undefined,
          attemptCount: execution.attemptCount,
          completedAt,
        },
      );
      return this.toResult(input.segment, completed);
    } catch (error) {
      const attemptCount =
        error instanceof TranscriptAdaptationRetryError
          ? error.attemptCount
          : error instanceof TranscriptAdaptationProviderError
            ? 1
            : 1;
      const code =
        error instanceof TranscriptAdaptationProviderError
          ? (failureCodeByProviderError[error.code] ??
            TranscriptAdaptationFailureCode.PROVIDER_ERROR)
          : TranscriptAdaptationFailureCode.PROVIDER_ERROR;
      return this.completeFallback(
        input.segment,
        code,
        attemptCount,
        Date.now() - startedAt,
      );
    }
  }

  async fallback(
    input: AdaptTranscriptSegmentInput,
    failureCode: TranscriptAdaptationFailureCode,
  ): Promise<AdaptTranscriptSegmentResult> {
    const existing = await this.adaptations.findBySegmentId(input.segment.id);
    if (existing && existing.status !== TranscriptAdaptationStatus.PENDING) {
      return this.toResult(input.segment, existing);
    }
    await (existing
      ? Promise.resolve(existing)
      : this.adaptations.createPending({
          transcriptSegmentId: input.segment.id,
          contextVersion: input.contextVersion,
          contextSnapshot: input.context,
          promptVersion: this.config.promptVersion,
          provider: this.provider.providerName,
          model: this.provider.modelName,
        }));
    return this.completeFallback(input.segment, failureCode, 0, 0);
  }

  private async completeBypass(
    segment: TranscriptSegment,
    failureCode: TranscriptAdaptationFailureCode,
    attemptCount = 0,
    latencyMs?: number,
    usage?: {
      inputTokens: number | null;
      cachedInputTokens: number | null;
      outputTokens: number | null;
    },
  ): Promise<AdaptTranscriptSegmentResult> {
    const completed = await this.adaptations.completeFailure(segment.id, {
      status: TranscriptAdaptationStatus.BYPASSED,
      failureCode,
      latencyMs,
      inputTokens: usage?.inputTokens ?? undefined,
      cachedInputTokens: usage?.cachedInputTokens ?? undefined,
      outputTokens: usage?.outputTokens ?? undefined,
      attemptCount,
      completedAt: new Date(),
    });
    return this.toResult(segment, completed);
  }

  private async completeFallback(
    segment: TranscriptSegment,
    failureCode: TranscriptAdaptationFailureCode,
    attemptCount: number,
    latencyMs: number,
    usage?: {
      inputTokens: number | null;
      cachedInputTokens: number | null;
      outputTokens: number | null;
    },
  ): Promise<AdaptTranscriptSegmentResult> {
    const completed = await this.adaptations.completeFailure(segment.id, {
      status: TranscriptAdaptationStatus.FALLBACK,
      failureCode,
      latencyMs,
      inputTokens: usage?.inputTokens ?? undefined,
      cachedInputTokens: usage?.cachedInputTokens ?? undefined,
      outputTokens: usage?.outputTokens ?? undefined,
      attemptCount,
      completedAt: new Date(),
    });
    return this.toResult(segment, completed);
  }

  private toResult(
    segment: TranscriptSegment,
    adaptation: TranscriptAdaptation,
  ): AdaptTranscriptSegmentResult {
    const status = this.publicStatus(adaptation.status);
    return {
      adaptation,
      event: {
        segmentId: segment.id,
        sessionId: segment.sessionId,
        seq: segment.seq,
        adaptation: {
          text:
            adaptation.status === TranscriptAdaptationStatus.SUCCEEDED &&
            adaptation.text
              ? adaptation.text
              : segment.text,
          status,
          failureCode: adaptation.failureCode,
          automatic: true,
          contextVersion: adaptation.contextVersion,
          promptVersion: adaptation.promptVersion,
          provider: adaptation.provider,
          model: adaptation.model,
          at: adaptation.completedAt ?? adaptation.updatedAt,
        },
      },
    };
  }

  private publicStatus(
    status: TranscriptAdaptationStatus,
  ): PublicTranscriptAdaptationStatus {
    if (status === TranscriptAdaptationStatus.SUCCEEDED) return 'succeeded';
    if (status === TranscriptAdaptationStatus.BYPASSED) return 'bypassed';
    return 'fallback';
  }
}
