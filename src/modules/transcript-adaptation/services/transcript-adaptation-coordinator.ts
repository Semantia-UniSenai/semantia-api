import { Injectable } from '@nestjs/common';
import { AsrAdaptationInputQuality } from '../../asr/asr-adaptation-input-quality';
import { AudienceContextSnapshot } from '../../sessions/entities/audience-context.entity';
import { TranscriptSegment } from '../../sessions/entities/transcript-segment.entity';
import { TranscriptAdaptationFailureCode } from '../entities/transcript-adaptation.entity';
import {
  AdaptTranscriptSegmentInput,
  AdaptTranscriptSegmentResult,
  AdaptTranscriptSegmentUseCase,
} from '../usecases/adapt-transcript-segment.usecase';
import {
  TranscriptAdaptationQueue,
  TranscriptAdaptationQueueFullError,
} from './transcript-adaptation-queue';

@Injectable()
export class TranscriptAdaptationCoordinator {
  private readonly scheduled = new Map<
    string,
    Promise<AdaptTranscriptSegmentResult>
  >();

  constructor(
    private readonly useCase: AdaptTranscriptSegmentUseCase,
    private readonly queue: TranscriptAdaptationQueue,
  ) {}

  enqueue(
    segment: TranscriptSegment,
    snapshot: AudienceContextSnapshot,
    inputQuality: AsrAdaptationInputQuality = AsrAdaptationInputQuality.ACCEPTABLE,
  ): Promise<AdaptTranscriptSegmentResult> {
    const existing = this.scheduled.get(segment.id);
    if (existing) return existing;

    const scheduled = this.schedule(segment, snapshot, inputQuality).finally(
      () => {
        this.scheduled.delete(segment.id);
      },
    );
    this.scheduled.set(segment.id, scheduled);
    return scheduled;
  }

  private async schedule(
    segment: TranscriptSegment,
    snapshot: AudienceContextSnapshot,
    inputQuality: AsrAdaptationInputQuality,
  ): Promise<AdaptTranscriptSegmentResult> {
    const input: AdaptTranscriptSegmentInput = {
      segment,
      context: snapshot.context,
      contextVersion: snapshot.contextVersion,
    };

    if (inputQuality !== AsrAdaptationInputQuality.ACCEPTABLE) {
      return this.useCase.bypass(
        input,
        TranscriptAdaptationFailureCode.SUSPECT_INPUT,
      );
    }

    try {
      return await this.queue.enqueue(segment.id, () =>
        this.useCase.execute(input),
      );
    } catch (error) {
      if (error instanceof TranscriptAdaptationQueueFullError) {
        return this.useCase.fallback(
          input,
          TranscriptAdaptationFailureCode.QUEUE_FULL,
        );
      }
      throw error;
    }
  }
}
