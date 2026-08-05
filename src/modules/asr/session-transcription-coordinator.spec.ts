import { SessionTranscriptionCoordinator } from './session-transcription-coordinator';

describe('SessionTranscriptionCoordinator', () => {
  it('coalesces duplicate segment work', async () => {
    const coordinator = new SessionTranscriptionCoordinator();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));
    const work = jest.fn(async () => {
      await blocked;
      return 'final';
    });

    const first = coordinator.enqueue('session-1', 'segment-0001', work);
    const duplicate = coordinator.enqueue('session-1', 'segment-0001', work);
    release();

    await expect(Promise.all([first, duplicate])).resolves.toEqual([
      'final',
      'final',
    ]);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('rejects work beyond the bounded per-session queue', async () => {
    const coordinator = new SessionTranscriptionCoordinator(2);
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = coordinator.enqueue('session-a', 'one', async () => {
      await blocker;
      return 1;
    });
    const second = coordinator.enqueue('session-a', 'two', () =>
      Promise.resolve(2),
    );

    await expect(
      coordinator.enqueue('session-a', 'three', () => Promise.resolve(3)),
    ).rejects.toMatchObject({ code: 'ASR_BUSY', retryable: true });

    release();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
  });

  it('serializes different segments inside one session', async () => {
    const coordinator = new SessionTranscriptionCoordinator();
    const order: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));

    const first = coordinator.enqueue('session-1', 'segment-0001', async () => {
      order.push('first:start');
      await blocked;
      order.push('first:end');
      return 1;
    });
    const second = coordinator.enqueue('session-1', 'segment-0002', () => {
      order.push('second');
      return Promise.resolve(2);
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(order).toEqual(['first:start']);
    release();

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('does not block a different session', async () => {
    const coordinator = new SessionTranscriptionCoordinator();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));
    const first = coordinator.enqueue(
      'session-1',
      'segment-0001',
      () => blocked,
    );
    const other = coordinator.enqueue('session-2', 'segment-0001', () =>
      Promise.resolve('ready'),
    );

    await expect(other).resolves.toBe('ready');
    release();
    await first;
  });
});
