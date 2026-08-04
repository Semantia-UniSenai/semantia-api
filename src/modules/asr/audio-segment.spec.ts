import { BadRequestException } from '@nestjs/common';
import { parseAudioSegment } from './audio-segment';

const pcm = (seconds: number) => Buffer.alloc(seconds * 16_000 * 2);

describe('parseAudioSegment', () => {
  it('normalizes a valid Socket.IO binary payload', () => {
    const result = parseAudioSegment({
      clientSegmentId: 'segment-0001',
      pcm16: new Uint8Array(pcm(1)),
      sampleRate: 16_000,
      durationMs: 1_000,
    });

    expect(result).toEqual({
      clientSegmentId: 'segment-0001',
      pcm16: pcm(1),
      sampleRate: 16_000,
      durationMs: 1_000,
      language: 'pt',
    });
  });

  it.each([
    [
      {
        clientSegmentId: 'short',
        pcm16: pcm(1),
        sampleRate: 16_000,
        durationMs: 1_000,
      },
    ],
    [
      {
        clientSegmentId: 'segment-0002',
        pcm16: Buffer.alloc(1),
        sampleRate: 16_000,
        durationMs: 1_000,
      },
    ],
    [
      {
        clientSegmentId: 'segment-0003',
        pcm16: pcm(1),
        sampleRate: 48_000,
        durationMs: 1_000,
      },
    ],
    [
      {
        clientSegmentId: 'segment-0004',
        pcm16: pcm(1),
        sampleRate: 16_000,
        durationMs: 4_000,
      },
    ],
    [
      {
        clientSegmentId: 'segment-0005',
        pcm16: pcm(31),
        sampleRate: 16_000,
        durationMs: 31_000,
      },
    ],
  ])('rejects an invalid audio envelope before ASR', (body) => {
    expect(() => parseAudioSegment(body)).toThrow(BadRequestException);
  });
});
