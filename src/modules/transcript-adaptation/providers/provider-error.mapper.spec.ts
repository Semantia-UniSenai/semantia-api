import { mapTranscriptAdaptationProviderError } from './provider-error.mapper';

describe('mapTranscriptAdaptationProviderError', () => {
  it.each([
    [400, 'INVALID_RESPONSE', false],
    [401, 'MISCONFIGURED', false],
    [403, 'MISCONFIGURED', false],
    [422, 'INVALID_RESPONSE', false],
    [429, 'RATE_LIMIT', true],
    [498, 'CAPACITY', true],
    [500, 'PROVIDER_ERROR', true],
    [502, 'PROVIDER_ERROR', true],
    [503, 'PROVIDER_ERROR', true],
  ])('mapeia HTTP %s para %s retryable=%s', (status, code, retryable) => {
    expect(mapTranscriptAdaptationProviderError({ status })).toMatchObject({
      code,
      retryable,
    });
  });

  it('normaliza Retry-After em segundos sem incluir o erro original', () => {
    const mapped = mapTranscriptAdaptationProviderError({
      status: 429,
      headers: { 'retry-after': '1.5' },
      message: 'secret response body',
    });

    expect(mapped).toMatchObject({
      code: 'RATE_LIMIT',
      retryable: true,
      retryAfterMs: 1_500,
    });
    expect(JSON.stringify(mapped)).not.toContain('secret response body');
  });

  it('mapeia AbortError para timeout retryable', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';

    expect(mapTranscriptAdaptationProviderError(error)).toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });
  });

  it('preserva erro interno já sanitizado', () => {
    const mapped = mapTranscriptAdaptationProviderError({
      code: 'INVALID_RESPONSE',
      retryable: false,
      name: 'TranscriptAdaptationProviderError',
    });

    expect(mapped).toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    });
  });
});
