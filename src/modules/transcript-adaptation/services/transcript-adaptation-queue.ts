export type TranscriptAdaptationQueueOptions = {
  maxConcurrency: number;
  maxQueue: number;
};

export class TranscriptAdaptationQueueFullError extends Error {
  readonly code = 'QUEUE_FULL';

  constructor() {
    super('QUEUE_FULL');
    this.name = 'TranscriptAdaptationQueueFullError';
  }
}

type QueueEntry<T> = {
  key: string;
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export class TranscriptAdaptationQueue {
  private running = 0;
  private readonly queued: QueueEntry<unknown>[] = [];
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(private readonly options: TranscriptAdaptationQueueOptions) {}

  enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const duplicate = this.inFlight.get(key);
    if (duplicate) return duplicate as Promise<T>;
    if (
      this.running >= this.options.maxConcurrency &&
      this.queued.length >= this.options.maxQueue
    ) {
      return Promise.reject(new TranscriptAdaptationQueueFullError());
    }

    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    const entry: QueueEntry<T> = { key, task, resolve, reject };
    this.inFlight.set(key, promise);
    if (this.running < this.options.maxConcurrency) this.start(entry);
    else this.queued.push(entry);
    return promise;
  }

  getStats(): { running: number; queued: number; inFlight: number } {
    return {
      running: this.running,
      queued: this.queued.length,
      inFlight: this.inFlight.size,
    };
  }

  private start<T>(entry: QueueEntry<T>): void {
    this.running += 1;
    let result: Promise<T>;
    try {
      result = entry.task();
    } catch (error) {
      result = Promise.reject(
        error instanceof Error ? error : new Error('QUEUE_TASK_FAILED'),
      );
    }
    void result.then(entry.resolve, entry.reject).finally(() => {
      this.running -= 1;
      this.inFlight.delete(entry.key);
      this.drain();
    });
  }

  private drain(): void {
    while (
      this.running < this.options.maxConcurrency &&
      this.queued.length > 0
    ) {
      const next = this.queued.shift();
      if (next) this.start(next);
    }
  }
}
