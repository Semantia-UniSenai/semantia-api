import { TranscriptAdaptationProviderError } from '../providers/transcript-adaptation.provider';
import { AdaptationCircuitBreaker } from './circuit-breaker';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('AdaptationCircuitBreaker', () => {
  it('abre após falhas transitórias consecutivas e rejeita rápido', async () => {
    let now = 0;
    const breaker = new AdaptationCircuitBreaker({
      failureThreshold: 2,
      resetMs: 1_000,
      now: () => now,
    });
    const failing = jest
      .fn()
      .mockRejectedValue(
        new TranscriptAdaptationProviderError('PROVIDER_ERROR', true),
      );

    await expect(breaker.execute(failing)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
    await expect(breaker.execute(failing)).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
    expect(breaker.getState()).toBe('OPEN');

    const blocked = jest.fn();
    await expect(breaker.execute(blocked)).rejects.toMatchObject({
      code: 'CIRCUIT_OPEN',
      retryable: false,
    });
    expect(blocked).not.toHaveBeenCalled();
    now += 500;
    expect(breaker.getState()).toBe('OPEN');
  });

  it('permite uma única probe half-open e fecha em sucesso', async () => {
    let now = 0;
    const breaker = new AdaptationCircuitBreaker({
      failureThreshold: 1,
      resetMs: 1_000,
      now: () => now,
    });
    await expect(
      breaker.execute(() =>
        Promise.reject(
          new TranscriptAdaptationProviderError('PROVIDER_ERROR', true),
        ),
      ),
    ).rejects.toBeInstanceOf(TranscriptAdaptationProviderError);
    now = 1_000;

    const probe = deferred<string>();
    const first = breaker.execute(() => probe.promise);
    await expect(
      breaker.execute(() => Promise.resolve('second')),
    ).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
    probe.resolve('ok');

    await expect(first).resolves.toBe('ok');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('erro determinístico não conta como instabilidade', async () => {
    const breaker = new AdaptationCircuitBreaker({
      failureThreshold: 1,
      resetMs: 1_000,
    });

    await expect(
      breaker.execute(() =>
        Promise.reject(
          new TranscriptAdaptationProviderError('INVALID_RESPONSE', false),
        ),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(breaker.getState()).toBe('CLOSED');
  });
});
