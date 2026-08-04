import { ConfigService } from '@nestjs/config';
import { HttpAsrClient } from './http-asr.client';

const request = {
  requestId: 'segment-0001',
  pcm16: Buffer.alloc(32_000),
  sampleRate: 16_000,
  durationMs: 1_000,
  language: 'pt' as const,
};

describe('HttpAsrClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends raw PCM only to the configured internal ASR URL', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: request.requestId,
          text: 'Semantia conecta pessoas',
          engine: 'faster-whisper',
          model: 'small',
          inferenceMs: 42,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const config = {
      get: jest.fn((name: string) => {
        if (name === 'ASR_URL') return 'http://asr:8000';
        if (name === 'ASR_TIMEOUT_MS') return '120000';
        return undefined;
      }),
    } as unknown as ConfigService;
    const client = new HttpAsrClient(config);

    await expect(client.transcribe(request)).resolves.toEqual({
      text: 'Semantia conecta pessoas',
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 42,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://asr:8000/v1/transcriptions',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(Uint8Array),
        headers: expect.objectContaining({
          'content-type': 'application/octet-stream',
          'x-request-id': request.requestId,
          'x-sample-rate': '16000',
          'x-duration-ms': '1000',
          'x-language': 'pt',
        }),
      }),
    );
    const sentBody = fetchMock.mock.calls[0]?.[1]?.body as Uint8Array;
    expect(Buffer.from(sentBody)).toEqual(request.pcm16);
  });

  it('maps provider overload to a stable retryable error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'QUEUE_FULL', message: 'internal detail' },
        }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new HttpAsrClient({
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(client.transcribe(request)).rejects.toMatchObject({
      code: 'ASR_BUSY',
      retryable: true,
    });
  });

  it('fails fast when the configured timeout is invalid', () => {
    const config = {
      get: jest.fn((name: string) =>
        name === 'ASR_TIMEOUT_MS' ? 'sometimes' : undefined,
      ),
    } as unknown as ConfigService;

    expect(() => new HttpAsrClient(config)).toThrow(
      'ASR_TIMEOUT_MS must be a positive integer',
    );
  });

  it('rejects a malformed success response instead of publishing invented text', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ text: '' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new HttpAsrClient({
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(client.transcribe(request)).rejects.toMatchObject({
      code: 'ASR_INVALID_RESPONSE',
      retryable: false,
    });
  });
});
