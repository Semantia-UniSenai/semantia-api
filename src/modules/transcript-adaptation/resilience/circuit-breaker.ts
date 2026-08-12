import { TranscriptAdaptationProviderError } from '../providers/transcript-adaptation.provider';

export type AdaptationCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type AdaptationCircuitBreakerOptions = {
  failureThreshold: number;
  resetMs: number;
  now?: () => number;
};

export class AdaptationCircuitBreaker {
  private state: AdaptationCircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenInFlight = false;
  private readonly now: () => number;

  constructor(private readonly options: AdaptationCircuitBreakerOptions) {
    this.now = options.now ?? Date.now;
  }

  getState(): AdaptationCircuitState {
    return this.state;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.now() - this.openedAt < this.options.resetMs) {
        throw new TranscriptAdaptationProviderError('CIRCUIT_OPEN', false);
      }
      if (this.halfOpenInFlight) {
        throw new TranscriptAdaptationProviderError('CIRCUIT_OPEN', false);
      }
      this.state = 'HALF_OPEN';
      this.halfOpenInFlight = true;
    } else if (this.state === 'HALF_OPEN' || this.halfOpenInFlight) {
      throw new TranscriptAdaptationProviderError('CIRCUIT_OPEN', false);
    }

    try {
      const result = await operation();
      this.close();
      return result;
    } catch (error) {
      const retryable =
        error instanceof TranscriptAdaptationProviderError && error.retryable;
      if (this.state === 'HALF_OPEN') {
        if (retryable) this.open();
        else this.close();
      } else if (retryable) {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.options.failureThreshold) {
          this.open();
        }
      } else {
        this.consecutiveFailures = 0;
      }
      throw error;
    } finally {
      if (this.state !== 'HALF_OPEN') this.halfOpenInFlight = false;
    }
  }

  private open(): void {
    this.state = 'OPEN';
    this.openedAt = this.now();
    this.halfOpenInFlight = false;
  }

  private close(): void {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.halfOpenInFlight = false;
  }
}
