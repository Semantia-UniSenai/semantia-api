import {
  TranscriptAdaptationProviderError,
  TranscriptAdaptationProviderErrorCode,
} from './transcript-adaptation.provider';

type ErrorLike = {
  name?: unknown;
  code?: unknown;
  retryable?: unknown;
  retryAfterMs?: unknown;
  status?: unknown;
  headers?: unknown;
};

const ERROR_CODES = new Set<TranscriptAdaptationProviderErrorCode>([
  'DISABLED',
  'MISCONFIGURED',
  'TIMEOUT',
  'RATE_LIMIT',
  'CAPACITY',
  'CIRCUIT_OPEN',
  'PROVIDER_ERROR',
  'INVALID_RESPONSE',
]);

const record = (value: unknown): ErrorLike | null =>
  value !== null && typeof value === 'object' ? value : null;

const headerValue = (headers: unknown, name: string): string | undefined => {
  if (!headers || typeof headers !== 'object') return undefined;
  const withGet = headers as { get?: (header: string) => unknown };
  const fromGet = withGet.get?.(name);
  if (typeof fromGet === 'string') return fromGet;
  const values = headers as Record<string, unknown>;
  const direct = values[name] ?? values[name.toLowerCase()];
  return typeof direct === 'string' ? direct : undefined;
};

const retryAfterMs = (headers: unknown): number | undefined => {
  const value = headerValue(headers, 'retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.round(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
};

export const mapTranscriptAdaptationProviderError = (
  error: unknown,
): TranscriptAdaptationProviderError => {
  if (error instanceof TranscriptAdaptationProviderError) return error;
  const source = record(error);
  if (
    source?.name === 'TranscriptAdaptationProviderError' &&
    typeof source.code === 'string' &&
    ERROR_CODES.has(source.code as TranscriptAdaptationProviderErrorCode)
  ) {
    return new TranscriptAdaptationProviderError(
      source.code as TranscriptAdaptationProviderErrorCode,
      source.retryable === true,
      typeof source.retryAfterMs === 'number' ? source.retryAfterMs : undefined,
    );
  }
  if (source?.name === 'AbortError') {
    return new TranscriptAdaptationProviderError('TIMEOUT', true);
  }

  const status = typeof source?.status === 'number' ? source.status : undefined;
  if (status === 401 || status === 403) {
    return new TranscriptAdaptationProviderError('MISCONFIGURED', false);
  }
  if (status === 400 || status === 422) {
    return new TranscriptAdaptationProviderError('INVALID_RESPONSE', false);
  }
  if (status === 429) {
    return new TranscriptAdaptationProviderError(
      'RATE_LIMIT',
      true,
      retryAfterMs(source?.headers),
    );
  }
  if (status === 498) {
    return new TranscriptAdaptationProviderError('CAPACITY', true);
  }
  return new TranscriptAdaptationProviderError(
    'PROVIDER_ERROR',
    status === undefined || status >= 500,
  );
};
