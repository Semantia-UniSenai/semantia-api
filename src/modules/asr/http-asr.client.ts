import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AsrClient,
  AsrClientError,
  AsrTranscriptionRequest,
  AsrTranscriptionResult,
} from './asr-client';

interface AsrSuccessBody {
  text?: unknown;
  engine?: unknown;
  model?: unknown;
  inferenceMs?: unknown;
}

@Injectable()
export class HttpAsrClient extends AsrClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    super();
    this.baseUrl = (
      config.get<string>('ASR_URL') ?? 'http://127.0.0.1:8000'
    ).replace(/\/+$/, '');
    const configuredTimeout = config.get<string | number>('ASR_TIMEOUT_MS');
    const timeoutMs = Number(configuredTimeout ?? 45_000);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('ASR_TIMEOUT_MS must be a positive integer');
    }
    this.timeoutMs = timeoutMs;
  }

  async transcribe(
    request: AsrTranscriptionRequest,
  ): Promise<AsrTranscriptionResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/transcriptions`, {
        method: 'POST',
        body: new Uint8Array(request.pcm16),
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'content-type': 'application/octet-stream',
          'x-request-id': request.requestId,
          'x-sample-rate': String(request.sampleRate),
          'x-duration-ms': String(request.durationMs),
          'x-language': request.language,
        },
      });
    } catch {
      throw new AsrClientError(
        'ASR_UNAVAILABLE',
        'Transcription service is unavailable',
        true,
      );
    }

    if (!response.ok) {
      if (response.status === 429 || response.status === 503) {
        throw new AsrClientError(
          'ASR_BUSY',
          'Transcription service is busy',
          true,
        );
      }
      throw new AsrClientError(
        'ASR_PROVIDER_ERROR',
        'Transcription service rejected the audio',
        response.status >= 500,
      );
    }

    const body = (await response
      .json()
      .catch(() => null)) as AsrSuccessBody | null;
    if (
      !body ||
      typeof body.text !== 'string' ||
      typeof body.engine !== 'string' ||
      !body.engine ||
      typeof body.model !== 'string' ||
      !body.model ||
      typeof body.inferenceMs !== 'number' ||
      !Number.isFinite(body.inferenceMs) ||
      body.inferenceMs < 0
    ) {
      throw new AsrClientError(
        'ASR_INVALID_RESPONSE',
        'Transcription service returned an invalid response',
        false,
      );
    }

    return {
      text: body.text.trim(),
      engine: body.engine,
      model: body.model,
      inferenceMs: Math.round(body.inferenceMs),
    };
  }
}
