import {
  TranscriptAdaptationQueue,
  TranscriptAdaptationQueueFullError,
} from './transcript-adaptation-queue';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('TranscriptAdaptationQueue', () => {
  it('respeita concorrência e inicia próximo ao concluir', async () => {
    const queue = new TranscriptAdaptationQueue({
      maxConcurrency: 2,
      maxQueue: 2,
    });
    const first = deferred<string>();
    const second = deferred<string>();
    const third = deferred<string>();
    const started: string[] = [];

    const p1 = queue.enqueue('1', () => {
      started.push('1');
      return first.promise;
    });
    const p2 = queue.enqueue('2', () => {
      started.push('2');
      return second.promise;
    });
    const p3 = queue.enqueue('3', () => {
      started.push('3');
      return third.promise;
    });

    expect(started).toEqual(['1', '2']);
    expect(queue.getStats()).toEqual({ running: 2, queued: 1, inFlight: 3 });
    first.resolve('one');
    await expect(p1).resolves.toBe('one');
    await Promise.resolve();
    expect(started).toEqual(['1', '2', '3']);
    second.resolve('two');
    third.resolve('three');
    await expect(Promise.all([p2, p3])).resolves.toEqual(['two', 'three']);
  });

  it('rejeita quando a fila está cheia sem cancelar jobs aceitos', async () => {
    const queue = new TranscriptAdaptationQueue({
      maxConcurrency: 1,
      maxQueue: 1,
    });
    const running = deferred<string>();
    const queued = deferred<string>();
    const p1 = queue.enqueue('1', () => running.promise);
    const p2 = queue.enqueue('2', () => queued.promise);

    await expect(
      queue.enqueue('3', () => Promise.resolve('three')),
    ).rejects.toBeInstanceOf(TranscriptAdaptationQueueFullError);
    running.resolve('one');
    await expect(p1).resolves.toBe('one');
    queued.resolve('two');
    await expect(p2).resolves.toBe('two');
  });

  it('duplicata concorrente compartilha a mesma Promise', async () => {
    const queue = new TranscriptAdaptationQueue({
      maxConcurrency: 1,
      maxQueue: 1,
    });
    const task = deferred<string>();
    const producer = jest.fn(() => task.promise);

    const first = queue.enqueue('segment-1', producer);
    const duplicate = queue.enqueue('segment-1', producer);

    expect(duplicate).toBe(first);
    expect(producer).toHaveBeenCalledTimes(1);
    task.resolve('done');
    await expect(first).resolves.toBe('done');
    expect(queue.getStats()).toEqual({ running: 0, queued: 0, inFlight: 0 });
  });
});
