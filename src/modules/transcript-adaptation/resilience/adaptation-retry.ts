import { mapTranscriptAdaptationProviderError } from '../providers/provider-error.mapper';
import {
  TranscriptAdaptationProviderError,
  TranscriptAdaptationRetryError,
} from '../providers/transcript-adaptation.provider';

export type AdaptationRetryOptions = {
  timeoutMs: number;
  maxRetries: number;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
};

const defaultSleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new TranscriptAdaptationProviderError('TIMEOUT', true));
      },
      { once: true },
    );
  });

const finalError = (
  error: unknown,
  attemptCount: number,
): TranscriptAdaptationRetryError => {
  const mapped = mapTranscriptAdaptationProviderError(error);
  return new TranscriptAdaptationRetryError(
    mapped.code,
    mapped.retryable,
    attemptCount,
    mapped.retryAfterMs,
  );
};

export const executeAdaptationWithRetry = async <T>(
  operation: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: AdaptationRetryOptions,
): Promise<{ result: T; attemptCount: number }> => {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const startedAt = now();
  const deadline = startedAt + options.timeoutMs;
  const controller = new AbortController();
  let attemptCount = 0;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(
        new TranscriptAdaptationRetryError(
          'TIMEOUT',
          true,
          Math.max(1, attemptCount),
        ),
      );
    }, options.timeoutMs);
  });

  try {
    while (true) {
      attemptCount += 1;
      try {
        const result = await Promise.race([
          operation(controller.signal, attemptCount),
          timeout,
        ]);
        return { result, attemptCount };
      } catch (error) {
        const mapped = finalError(error, attemptCount);
        const retriesUsed = attemptCount - 1;
        if (
          controller.signal.aborted ||
          !mapped.retryable ||
          retriesUsed >= options.maxRetries
        ) {
          throw mapped;
        }

        const baseDelay = 100 * 2 ** retriesUsed;
        const jitteredDelay = Math.round(baseDelay * (0.75 + random() * 0.5));
        const delay = mapped.retryAfterMs ?? jitteredDelay;
        if (now() + delay >= deadline) throw mapped;
        await Promise.race([sleep(delay, controller.signal), timeout]);
      }
    }
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};
