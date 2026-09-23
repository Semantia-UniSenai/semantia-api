import { buildTranscriptAdaptationTestInput } from '../testing/transcript-adaptation-test.helpers';
import { DisabledTranscriptAdaptationProvider } from './disabled-transcript-adaptation.provider';
import { FakeTranscriptAdaptationProvider } from './fake-transcript-adaptation.provider';
import {
  TranscriptAdaptationProviderError,
  TranscriptAdaptationProviderErrorCode,
} from './transcript-adaptation.provider';

describe('transcript adaptation providers without network', () => {
  const input = buildTranscriptAdaptationTestInput();

  it('fake retorna saída configurada e conta uma única chamada', async () => {
    const provider = new FakeTranscriptAdaptationProvider({
      mode: 'success',
      output: {
        adaptedText: 'A reunião começa às 14h30.',
        decision: 'adapted',
        risk: 'none',
      },
    });

    const result = await provider.adapt(input, new AbortController().signal);

    expect(result).toEqual({
      output: {
        adaptedText: 'A reunião começa às 14h30.',
        decision: 'adapted',
        risk: 'none',
      },
      provider: 'fake',
      model: 'fake-deterministic-v1',
      usage: {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
      },
    });
    expect(provider.callCount).toBe(1);
    expect(provider.inputs).toEqual([input]);
  });

  it.each<{
    mode: 'error' | 'invalid-response';
    code: TranscriptAdaptationProviderErrorCode;
  }>([
    { mode: 'error', code: 'PROVIDER_ERROR' },
    { mode: 'invalid-response', code: 'INVALID_RESPONSE' },
  ])(
    'fake mapeia $mode para $code sem retry implícito',
    async ({ mode, code }) => {
      const provider = new FakeTranscriptAdaptationProvider({ mode });

      await expect(
        provider.adapt(input, new AbortController().signal),
      ).rejects.toMatchObject({ code, retryable: false });
      expect(provider.callCount).toBe(1);
    },
  );

  it('fake timeout só termina quando o caller aborta', async () => {
    const controller = new AbortController();
    const provider = new FakeTranscriptAdaptationProvider({ mode: 'timeout' });
    const pending = provider.adapt(input, controller.signal);

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });
  });

  it('disabled falha localmente com código explícito', async () => {
    const provider = new DisabledTranscriptAdaptationProvider();

    await expect(
      provider.adapt(input, new AbortController().signal),
    ).rejects.toEqual(
      expect.objectContaining<Partial<TranscriptAdaptationProviderError>>({
        code: 'DISABLED',
        retryable: false,
      }),
    );
  });
});
