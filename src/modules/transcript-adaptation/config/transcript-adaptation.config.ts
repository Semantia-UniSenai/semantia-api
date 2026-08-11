import { z } from 'zod';

export type TranscriptAdaptationProviderName = 'disabled' | 'fake' | 'groq';
export type TranscriptAdaptationProviderState =
  'disabled' | 'ready' | 'misconfigured';

export type TranscriptAdaptationPublicState = {
  enabled: boolean;
  provider: TranscriptAdaptationProviderName;
  state: TranscriptAdaptationProviderState;
  reason?: 'missing-groq-api-key';
  model: string;
  promptVersion: string;
  timeoutMs: number;
  maxRetries: number;
  maxConcurrency: number;
  maxQueue: number;
  circuitFailureThreshold: number;
  circuitResetMs: number;
  temperature: number;
  maxOutputTokens: number;
};

const integer = (defaultValue: number, minimum: number, maximum: number) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((value) => Number(value))
    .pipe(z.number().int().min(minimum).max(maximum));

const decimal = (defaultValue: number, minimum: number, maximum: number) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((value) => Number(value))
    .pipe(z.number().min(minimum).max(maximum));

const envSchema = z.object({
  TRANSCRIPT_ADAPTATION_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  TRANSCRIPT_ADAPTATION_PROVIDER: z
    .enum(['disabled', 'fake', 'groq'])
    .default('disabled'),
  TRANSCRIPT_ADAPTATION_MODEL: z.string().min(1).default('openai/gpt-oss-20b'),
  TRANSCRIPT_ADAPTATION_PROMPT_VERSION: z
    .string()
    .min(1)
    .default('pt-br-accessible-v1'),
  TRANSCRIPT_ADAPTATION_TIMEOUT_MS: integer(2_500, 1, 30_000),
  TRANSCRIPT_ADAPTATION_MAX_RETRIES: integer(1, 0, 1),
  TRANSCRIPT_ADAPTATION_MAX_CONCURRENCY: integer(2, 1, 32),
  TRANSCRIPT_ADAPTATION_MAX_QUEUE: integer(32, 0, 10_000),
  TRANSCRIPT_ADAPTATION_CIRCUIT_FAILURE_THRESHOLD: integer(5, 1, 100),
  TRANSCRIPT_ADAPTATION_CIRCUIT_RESET_MS: integer(30_000, 1, 600_000),
  TRANSCRIPT_ADAPTATION_TEMPERATURE: decimal(0.1, 0, 1),
  TRANSCRIPT_ADAPTATION_MAX_OUTPUT_TOKENS: integer(512, 1, 5_000),
});

export class TranscriptAdaptationRuntimeConfig {
  readonly enabled: boolean;
  readonly provider: TranscriptAdaptationProviderName;
  readonly model: string;
  readonly promptVersion: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly maxConcurrency: number;
  readonly maxQueue: number;
  readonly circuitFailureThreshold: number;
  readonly circuitResetMs: number;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  #groqApiKey: string | undefined;

  constructor(
    values: Omit<TranscriptAdaptationPublicState, 'state' | 'reason'>,
    groqApiKey?: string,
  ) {
    Object.assign(this, values);
    this.#groqApiKey = groqApiKey;
  }

  getGroqApiKey(): string | undefined {
    return this.#groqApiKey;
  }

  toPublicState(): TranscriptAdaptationPublicState {
    if (!this.enabled || this.provider === 'disabled') {
      return { ...this.publicValues(), state: 'disabled' };
    }
    if (this.provider === 'groq' && !this.#groqApiKey) {
      return {
        ...this.publicValues(),
        state: 'misconfigured',
        reason: 'missing-groq-api-key',
      };
    }
    return { ...this.publicValues(), state: 'ready' };
  }

  toJSON(): TranscriptAdaptationPublicState {
    return this.toPublicState();
  }

  private publicValues(): Omit<
    TranscriptAdaptationPublicState,
    'state' | 'reason'
  > {
    return {
      enabled: this.enabled,
      provider: this.provider,
      model: this.model,
      promptVersion: this.promptVersion,
      timeoutMs: this.timeoutMs,
      maxRetries: this.maxRetries,
      maxConcurrency: this.maxConcurrency,
      maxQueue: this.maxQueue,
      circuitFailureThreshold: this.circuitFailureThreshold,
      circuitResetMs: this.circuitResetMs,
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
    };
  }
}

export const loadTranscriptAdaptationConfig = (
  env: Record<string, string | undefined>,
): TranscriptAdaptationRuntimeConfig => {
  const parsed = envSchema.parse(env);
  const enabled = parsed.TRANSCRIPT_ADAPTATION_ENABLED;
  const provider = enabled
    ? parsed.TRANSCRIPT_ADAPTATION_PROVIDER
    : ('disabled' as const);
  const groqApiKey =
    enabled && provider === 'groq'
      ? env.GROQ_API_KEY?.trim() || undefined
      : undefined;

  return new TranscriptAdaptationRuntimeConfig(
    {
      enabled,
      provider,
      model: parsed.TRANSCRIPT_ADAPTATION_MODEL,
      promptVersion: parsed.TRANSCRIPT_ADAPTATION_PROMPT_VERSION,
      timeoutMs: parsed.TRANSCRIPT_ADAPTATION_TIMEOUT_MS,
      maxRetries: parsed.TRANSCRIPT_ADAPTATION_MAX_RETRIES,
      maxConcurrency: parsed.TRANSCRIPT_ADAPTATION_MAX_CONCURRENCY,
      maxQueue: parsed.TRANSCRIPT_ADAPTATION_MAX_QUEUE,
      circuitFailureThreshold:
        parsed.TRANSCRIPT_ADAPTATION_CIRCUIT_FAILURE_THRESHOLD,
      circuitResetMs: parsed.TRANSCRIPT_ADAPTATION_CIRCUIT_RESET_MS,
      temperature: parsed.TRANSCRIPT_ADAPTATION_TEMPERATURE,
      maxOutputTokens: parsed.TRANSCRIPT_ADAPTATION_MAX_OUTPUT_TOKENS,
    },
    groqApiKey,
  );
};
