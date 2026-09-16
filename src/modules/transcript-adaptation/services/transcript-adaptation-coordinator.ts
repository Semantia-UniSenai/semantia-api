import { Injectable } from '@nestjs/common';
import { TranscriptSegment } from '../../sessions/entities/transcript-segment.entity';
import { RoomSessionRepository } from '../../sessions/repositories/live-session.repository';
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
    private readonly sessions: RoomSessionRepository,
    private readonly useCase: AdaptTranscriptSegmentUseCase,
    private readonly queue: TranscriptAdaptationQueue,
  ) {}

  enqueue(segment: TranscriptSegment): Promise<AdaptTranscriptSegmentResult> {
    const existing = this.scheduled.get(segment.id);
    if (existing) return existing;

    const scheduled = this.schedule(segment).finally(() => {
      this.scheduled.delete(segment.id);
    });
    this.scheduled.set(segment.id, scheduled);
    return scheduled;
  }

  private async schedule(
    segment: TranscriptSegment,
  ): Promise<AdaptTranscriptSegmentResult> {
    const session = await this.sessions.findById(segment.sessionId);
    const input: AdaptTranscriptSegmentInput = {
      segment,
      context: session?.audienceContext ?? null,
      contextVersion: session?.audienceContextVersion ?? 0,
    };

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
