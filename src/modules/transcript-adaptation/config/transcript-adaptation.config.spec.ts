import { loadTranscriptAdaptationConfig } from './transcript-adaptation.config';

describe('loadTranscriptAdaptationConfig', () => {
  it('disabled usa defaults e não lê GROQ_API_KEY', () => {
    const env = new Proxy<Record<string, string | undefined>>(
      { TRANSCRIPT_ADAPTATION_ENABLED: 'false' },
      {
        get(target, property: string) {
          if (property === 'GROQ_API_KEY') {
            throw new Error('secret must not be read');
          }
          return target[property];
        },
      },
    );

    const config = loadTranscriptAdaptationConfig(env);

    expect(config.toPublicState()).toMatchObject({
      enabled: false,
      provider: 'disabled',
      state: 'disabled',
      model: 'openai/gpt-oss-20b',
      promptVersion: 'pt-br-accessible-v2',
      timeoutMs: 2_500,
      maxRetries: 1,
      maxConcurrency: 2,
      maxQueue: 32,
    });
  });

  it('fake fica ready sem chave', () => {
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'true',
      TRANSCRIPT_ADAPTATION_PROVIDER: 'fake',
    });

    expect(config.toPublicState().state).toBe('ready');
    expect(config.getGroqApiKey()).toBeUndefined();
  });

  it('groq sem chave fica misconfigured sem falhar silenciosamente', () => {
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'true',
      TRANSCRIPT_ADAPTATION_PROVIDER: 'groq',
    });

    expect(config.toPublicState().state).toBe('misconfigured');
    expect(config.toPublicState().reason).toBe('missing-groq-api-key');
  });

  it('mantém chave fora de serialização e estado público', () => {
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'true',
      TRANSCRIPT_ADAPTATION_PROVIDER: 'groq',
      GROQ_API_KEY: 'synthetic-test-secret',
    });

    expect(config.toPublicState().state).toBe('ready');
    expect(config.getGroqApiKey()).toBe('synthetic-test-secret');
    expect(JSON.stringify(config)).not.toContain('synthetic-test-secret');
    expect(JSON.stringify(config.toPublicState())).not.toContain(
      'synthetic-test-secret',
    );
  });

  it.each([
    ['TRANSCRIPT_ADAPTATION_TIMEOUT_MS', '0'],
    ['TRANSCRIPT_ADAPTATION_MAX_RETRIES', '-1'],
    ['TRANSCRIPT_ADAPTATION_MAX_CONCURRENCY', '0'],
    ['TRANSCRIPT_ADAPTATION_MAX_QUEUE', '-1'],
    ['TRANSCRIPT_ADAPTATION_TEMPERATURE', '2'],
  ])('rejeita configuração inválida %s=%s', (name, value) => {
    expect(() =>
      loadTranscriptAdaptationConfig({
        TRANSCRIPT_ADAPTATION_ENABLED: 'true',
        TRANSCRIPT_ADAPTATION_PROVIDER: 'fake',
        [name]: value,
      }),
    ).toThrow();
  });

  it('rejeita versão de prompt sem implementação correspondente', () => {
    expect(() =>
      loadTranscriptAdaptationConfig({
        TRANSCRIPT_ADAPTATION_PROMPT_VERSION: 'invented-v99',
      }),
    ).toThrow();
  });
});
