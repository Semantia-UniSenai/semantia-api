export interface AsrTranscriptionRequest {
  requestId: string;
  pcm16: Buffer;
  sampleRate: 16_000;
  durationMs: number;
  language: 'pt';
}

export interface AsrTranscriptionResult {
  text: string;
  engine: string;
  model: string;
  inferenceMs: number;
}

export abstract class AsrClient {
  abstract transcribe(
    request: AsrTranscriptionRequest,
  ): Promise<AsrTranscriptionResult>;
}

export class AsrClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
