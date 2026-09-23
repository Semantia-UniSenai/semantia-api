import type { AudienceContext } from '../../sessions/entities/audience-context.entity';

export const TranscriptAdaptationStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FALLBACK: 'FALLBACK',
  BYPASSED: 'BYPASSED',
} as const;

export type TranscriptAdaptationStatus =
  (typeof TranscriptAdaptationStatus)[keyof typeof TranscriptAdaptationStatus];

export const TranscriptAdaptationFailureCode = {
  DISABLED: 'DISABLED',
  MISCONFIGURED: 'MISCONFIGURED',
  NO_CONTEXT: 'NO_CONTEXT',
  HIGH_RISK: 'HIGH_RISK',
  SUSPECT_INPUT: 'SUSPECT_INPUT',
  QUEUE_FULL: 'QUEUE_FULL',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMIT: 'RATE_LIMIT',
  CAPACITY: 'CAPACITY',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  PRESERVATION_FAILED: 'PRESERVATION_FAILED',
  PROCESS_INTERRUPTED: 'PROCESS_INTERRUPTED',
} as const;

export type TranscriptAdaptationFailureCode =
  (typeof TranscriptAdaptationFailureCode)[keyof typeof TranscriptAdaptationFailureCode];

export class TranscriptAdaptation {
  id: string;
  transcriptSegmentId: string;
  text: string | null;
  status: TranscriptAdaptationStatus;
  failureCode: TranscriptAdaptationFailureCode | null;
  contextVersion: number;
  contextSnapshot: AudienceContext | null;
  promptVersion: string;
  provider: string;
  model: string;
  latencyMs: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;

  constructor(props: TranscriptAdaptation) {
    Object.assign(this, props);
  }
}
