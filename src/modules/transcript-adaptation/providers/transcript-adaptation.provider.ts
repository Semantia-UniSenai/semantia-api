import {
  TranscriptAdaptationInput,
  TranscriptAdaptationProviderResult,
} from '../contracts/transcript-adaptation.types';

export const TranscriptAdaptationProviderErrorCode = {
  DISABLED: 'DISABLED',
  MISCONFIGURED: 'MISCONFIGURED',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  CAPACITY: 'CAPACITY',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

export type TranscriptAdaptationProviderErrorCode =
  (typeof TranscriptAdaptationProviderErrorCode)[keyof typeof TranscriptAdaptationProviderErrorCode];

export class TranscriptAdaptationProviderError extends Error {
  constructor(
    readonly code: TranscriptAdaptationProviderErrorCode,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(code);
    this.name = 'TranscriptAdaptationProviderError';
  }
}

export class TranscriptAdaptationRetryError extends TranscriptAdaptationProviderError {
  constructor(
    code: TranscriptAdaptationProviderErrorCode,
    retryable: boolean,
    readonly attemptCount: number,
    retryAfterMs?: number,
  ) {
    super(code, retryable, retryAfterMs);
    this.name = 'TranscriptAdaptationRetryError';
  }
}

export abstract class TranscriptAdaptationProvider {
  abstract readonly providerName: string;
  abstract readonly modelName: string;

  abstract adapt(
    input: TranscriptAdaptationInput,
    signal: AbortSignal,
  ): Promise<TranscriptAdaptationProviderResult>;
}
