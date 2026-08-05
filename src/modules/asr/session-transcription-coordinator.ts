import { Inject, Injectable, Optional } from '@nestjs/common';
import { AsrClientError } from './asr-client';

export const ASR_SESSION_QUEUE_LIMIT = Symbol('ASR_SESSION_QUEUE_LIMIT');

@Injectable()
export class SessionTranscriptionCoordinator {
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly sessionTails = new Map<string, Promise<void>>();
  private readonly pendingBySession = new Map<string, number>();

  constructor(
    @Optional()
    @Inject(ASR_SESSION_QUEUE_LIMIT)
    private readonly maxPendingPerSession = 8,
  ) {}

  enqueue<T>(
    sessionId: string,
    clientSegmentId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const key = `${sessionId}:${clientSegmentId}`;
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const pending = this.pendingBySession.get(sessionId) ?? 0;
    if (pending >= this.maxPendingPerSession) {
      return Promise.reject(
        new AsrClientError(
          'ASR_BUSY',
          'A fila de transcrição da sessão está cheia',
          true,
        ),
      );
    }
    this.pendingBySession.set(sessionId, pending + 1);

    const previous = this.sessionTails.get(sessionId) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(work);
    this.inflight.set(key, task);

    const tail = task.then(
      () => undefined,
      () => undefined,
    );
    this.sessionTails.set(sessionId, tail);
    void task
      .finally(() => {
        if (this.inflight.get(key) === task) this.inflight.delete(key);
        const remaining = (this.pendingBySession.get(sessionId) ?? 1) - 1;
        if (remaining > 0) this.pendingBySession.set(sessionId, remaining);
        else this.pendingBySession.delete(sessionId);
        if (this.sessionTails.get(sessionId) === tail) {
          this.sessionTails.delete(sessionId);
        }
      })
      .catch(() => undefined);

    return task;
  }
}
