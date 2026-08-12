import {
  loadTranscriptAdaptationConfig,
  TranscriptAdaptationRuntimeConfig,
} from '../src/modules/transcript-adaptation/config/transcript-adaptation.config';
import { loadTranscriptAdaptationCorpus } from '../src/modules/transcript-adaptation/evaluation/transcript-adaptation-corpus';
import {
  evaluateTranscriptAdaptationGuards,
  evaluateTranscriptAdaptationProvider,
} from '../src/modules/transcript-adaptation/evaluation/transcript-adaptation-evaluator';
import { createTranscriptAdaptationProvider } from '../src/modules/transcript-adaptation/providers/transcript-adaptation-provider.factory';

const readArgument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};

const parseLimit = (): number | undefined => {
  const raw = readArgument('limit');
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error('INVALID_LIMIT');
  }
  return value;
};

const safeProviderState = (config: TranscriptAdaptationRuntimeConfig) => {
  const state = config.toPublicState();
  return {
    enabled: state.enabled,
    provider: state.provider,
    model: state.model,
    promptVersion: state.promptVersion,
    state: state.state,
  };
};

async function main(): Promise<void> {
  const mode = readArgument('mode') ?? 'guards';
  const corpus = loadTranscriptAdaptationCorpus();
  if (!corpus.syntheticOnly) throw new Error('NON_SYNTHETIC_CORPUS');

  if (mode === 'guards') {
    const summary = evaluateTranscriptAdaptationGuards(corpus);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.mismatches.length > 0) process.exitCode = 1;
    return;
  }
  if (mode !== 'provider') throw new Error('INVALID_MODE');

  const config = loadTranscriptAdaptationConfig(process.env);
  const publicState = safeProviderState(config);
  if (publicState.state !== 'ready') {
    console.error(
      JSON.stringify({
        code: 'PROVIDER_NOT_READY',
        transcriptAdaptation: publicState,
      }),
    );
    process.exitCode = 2;
    return;
  }
  const provider = createTranscriptAdaptationProvider(config);
  const summary = await evaluateTranscriptAdaptationProvider(corpus, provider, {
    limit: parseLimit(),
    timeoutMs: config.timeoutMs,
  });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.providerErrors > 0 || summary.semanticFallbacks > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  const allowedCodes = new Set([
    'INVALID_LIMIT',
    'INVALID_MODE',
    'NON_SYNTHETIC_CORPUS',
  ]);
  const code =
    error instanceof Error && allowedCodes.has(error.message)
      ? error.message
      : 'EVALUATION_FAILED';
  console.error(JSON.stringify({ code }));
  process.exitCode = 1;
});
