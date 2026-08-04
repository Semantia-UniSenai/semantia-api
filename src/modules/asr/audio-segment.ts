import { BadRequestException } from '@nestjs/common';

const CLIENT_SEGMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
export const ASR_SAMPLE_RATE = 16_000;
export const MIN_AUDIO_DURATION_MS = 250;
export const MAX_AUDIO_DURATION_MS = 30_000;
const DURATION_TOLERANCE_MS = 80;

export interface AudioSegmentInput {
  clientSegmentId: string;
  pcm16: Buffer;
  sampleRate: typeof ASR_SAMPLE_RATE;
  durationMs: number;
  language: 'pt';
}

function binaryBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return null;
}

function invalid(message: string): never {
  throw new BadRequestException(message);
}

export function parseAudioSegment(body: unknown): AudioSegmentInput {
  if (!body || typeof body !== 'object') invalid('Invalid audio segment');
  const value = body as Record<string, unknown>;
  const clientSegmentId =
    typeof value.clientSegmentId === 'string'
      ? value.clientSegmentId.trim()
      : '';
  if (!CLIENT_SEGMENT_ID_PATTERN.test(clientSegmentId)) {
    invalid('Invalid clientSegmentId');
  }

  const pcm16 = binaryBuffer(value.pcm16);
  if (!pcm16 || pcm16.length === 0 || pcm16.length % 2 !== 0) {
    invalid('Invalid PCM16 audio');
  }
  if (value.sampleRate !== ASR_SAMPLE_RATE) {
    invalid(`Audio sample rate must be ${ASR_SAMPLE_RATE} Hz`);
  }

  const measuredDurationMs = Math.round(
    ((pcm16.length / 2) * 1_000) / ASR_SAMPLE_RATE,
  );
  if (measuredDurationMs < MIN_AUDIO_DURATION_MS) {
    invalid('Audio segment is too short');
  }
  if (measuredDurationMs > MAX_AUDIO_DURATION_MS) {
    invalid('Audio segment is too long');
  }
  if (!Number.isInteger(value.durationMs) || Number(value.durationMs) <= 0) {
    invalid('Invalid audio duration');
  }
  const tolerance = Math.max(
    DURATION_TOLERANCE_MS,
    Math.round(measuredDurationMs * 0.05),
  );
  if (Math.abs(Number(value.durationMs) - measuredDurationMs) > tolerance) {
    invalid('Audio duration does not match its payload');
  }

  return {
    clientSegmentId,
    pcm16,
    sampleRate: ASR_SAMPLE_RATE,
    durationMs: measuredDurationMs,
    language: 'pt',
  };
}
