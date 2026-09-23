import { loadTranscriptAdaptationCorpus } from './transcript-adaptation-corpus';
import { TranscriptAdaptationProvider } from '../providers/transcript-adaptation.provider';
import {
  evaluateTranscriptAdaptationGuards,
  evaluateTranscriptAdaptationProvider,
} from './transcript-adaptation-evaluator';

describe('transcript adaptation evaluation harness', () => {
  it('produz somente métricas agregadas para todo o corpus', () => {
    const summary = evaluateTranscriptAdaptationGuards(
      loadTranscriptAdaptationCorpus(),
    );

    expect(summary.total).toBe(100);
    expect(summary.mismatches).toEqual([]);
    expect(
      Object.values(summary.outcomes).reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBe(summary.total);
    expect(summary.latencyMs.p50).toBeGreaterThanOrEqual(0);
    expect(summary.latencyMs.p95).toBeGreaterThanOrEqual(summary.latencyMs.p50);
    expect(summary.categories).toBe(20);
    expect(JSON.stringify(summary)).not.toMatch(
      /literalText|candidate|adaptedText/,
    );
  });

  it('não envia casos urgentes ao provider nem inclui conteúdo no resumo', async () => {
    const provider: TranscriptAdaptationProvider = {
      providerName: 'fake',
      modelName: 'fake-evaluation',
      adapt: jest.fn((input, signal) => {
        expect(signal).toBeInstanceOf(AbortSignal);
        return Promise.resolve({
          output: {
            adaptedText: input.literalText,
            decision: 'literal' as const,
            risk: 'none' as const,
          },
          provider: 'fake',
          model: 'fake-evaluation',
          usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
        });
      }),
    };

    const summary = await evaluateTranscriptAdaptationProvider(
      loadTranscriptAdaptationCorpus(),
      provider,
    );

    expect(provider.adapt).toHaveBeenCalledTimes(90);
    expect(summary).toMatchObject({
      total: 100,
      locallyBypassed: 10,
      accepted: 90,
      literalDecisions: 90,
      semanticFallbacks: 0,
      providerErrors: 0,
      usage: { inputTokens: 90, outputTokens: 90 },
    });
    expect(JSON.stringify(summary)).not.toMatch(
      /literalText|candidate|adaptedText|Texto|relatório/i,
    );
  });
});
