import { loadTranscriptAdaptationConfig } from '../config/transcript-adaptation.config';
import { buildTranscriptAdaptationTestInput } from '../testing/transcript-adaptation-test.helpers';
import { FakeTranscriptAdaptationProvider } from './fake-transcript-adaptation.provider';
import { GroqTranscriptAdaptationProvider } from './groq-transcript-adaptation.provider';
import { createTranscriptAdaptationProvider } from './transcript-adaptation-provider.factory';

describe('createTranscriptAdaptationProvider', () => {
  it('disabled não constrói cliente Groq', () => {
    const createGroqClient = jest.fn();
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'false',
    });

    const provider = createTranscriptAdaptationProvider(config, {
      createGroqClient,
    });

    expect(provider.providerName).toBe('disabled');
    expect(createGroqClient).not.toHaveBeenCalled();
  });

  it('fake é selecionável sem chave', () => {
    const createGroqClient = jest.fn();
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'true',
      TRANSCRIPT_ADAPTATION_PROVIDER: 'fake',
    });

    const provider = createTranscriptAdaptationProvider(config, {
      createGroqClient,
    });

    expect(provider).toBeInstanceOf(FakeTranscriptAdaptationProvider);
    expect(createGroqClient).not.toHaveBeenCalled();
  });

  it('groq sem chave produz erro local misconfigured', async () => {
    const createGroqClient = jest.fn();
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'true',
      TRANSCRIPT_ADAPTATION_PROVIDER: 'groq',
    });
    const provider = createTranscriptAdaptationProvider(config, {
      createGroqClient,
    });

    await expect(
      provider.adapt(
        buildTranscriptAdaptationTestInput(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'MISCONFIGURED', retryable: false });
    expect(createGroqClient).not.toHaveBeenCalled();
  });

  it('groq ready entrega chave somente ao construtor injetado', () => {
    const completions = { create: jest.fn() };
    const createGroqClient = jest.fn().mockReturnValue(completions);
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'true',
      TRANSCRIPT_ADAPTATION_PROVIDER: 'groq',
      GROQ_API_KEY: 'synthetic-test-secret',
    });

    const provider = createTranscriptAdaptationProvider(config, {
      createGroqClient,
    });

    expect(provider).toBeInstanceOf(GroqTranscriptAdaptationProvider);
    expect(createGroqClient).toHaveBeenCalledWith({
      apiKey: 'synthetic-test-secret',
      maxRetries: 0,
      timeout: 2_500,
    });
  });
});
