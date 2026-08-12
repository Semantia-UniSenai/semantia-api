import {
  TranscriptAdaptationProviderError,
  TranscriptAdaptationRetryError,
} from '../providers/transcript-adaptation.provider';
import { executeAdaptationWithRetry } from './adaptation-retry';

describe('executeAdaptationWithRetry', () => {
  afterEach(() => jest.useRealTimers());

  it('aborta e rejeita operação travada no deadline total', async () => {
    jest.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    const operation = jest.fn((signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<string>(() => undefined);
    });

    const pending = executeAdaptationWithRetry(operation, {
      timeoutMs: 100,
      maxRetries: 0,
    });
    const rejection = expect(pending).rejects.toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
      attemptCount: 1,
    });
    await jest.advanceTimersByTimeAsync(100);

    await rejection;
    expect(observedSignal?.aborted).toBe(true);
  });

  it('repete uma vez somente para erro retryable', async () => {
    let now = 0;
    const sleep = jest.fn((ms: number) => {
      now += ms;
      return Promise.resolve();
    });
    const operation = jest
      .fn()
      .mockRejectedValueOnce(
        new TranscriptAdaptationProviderError('PROVIDER_ERROR', true),
      )
      .mockResolvedValueOnce('ok');

    await expect(
      executeAdaptationWithRetry(operation, {
        timeoutMs: 1_000,
        maxRetries: 1,
        now: () => now,
        sleep,
        random: () => 0.5,
      }),
    ).resolves.toEqual({ result: 'ok', attemptCount: 2 });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100, expect.any(AbortSignal));
  });

  it('não repete erro determinístico', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(
        new TranscriptAdaptationProviderError('INVALID_RESPONSE', false),
      );

    await expect(
      executeAdaptationWithRetry(operation, {
        timeoutMs: 1_000,
        maxRetries: 1,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<TranscriptAdaptationRetryError>>({
        code: 'INVALID_RESPONSE',
        attemptCount: 1,
      }),
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('não inicia retry-after que ultrapassa o deadline', async () => {
    const operation = jest
      .fn()
      .mockRejectedValue(
        new TranscriptAdaptationProviderError('RATE_LIMIT', true, 2_000),
      );
    const sleep = jest.fn();

    await expect(
      executeAdaptationWithRetry(operation, {
        timeoutMs: 1_000,
        maxRetries: 1,
        now: () => 0,
        sleep,
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT', attemptCount: 1 });
    expect(sleep).not.toHaveBeenCalled();
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
