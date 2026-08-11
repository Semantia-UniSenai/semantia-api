import { performance } from 'node:perf_hooks';
import { detectHighRiskContent } from '../validation/high-risk-content.detector';
import { validateSemanticPreservation } from '../validation/semantic-preservation.validator';
import { TranscriptAdaptationProvider } from '../providers/transcript-adaptation.provider';
import type {
  TranscriptAdaptationCorpus,
  TranscriptAdaptationCorpusCase,
} from './transcript-adaptation-corpus';

type EvaluationOutcome = TranscriptAdaptationCorpusCase['expectedOutcome'];

export interface TranscriptAdaptationGuardSummary {
  mode: 'guards';
  corpusVersion: string;
  syntheticOnly: true;
  total: number;
  categories: number;
  outcomes: Record<EvaluationOutcome, number>;
  mismatches: string[];
  latencyMs: {
    p50: number;
    p95: number;
    max: number;
  };
}

const percentile = (sorted: readonly number[], value: number): number => {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * value) - 1),
  );
  return sorted[index] ?? 0;
};

const evaluateCase = (
  item: TranscriptAdaptationCorpusCase,
): EvaluationOutcome => {
  if (detectHighRiskContent(item.literalText).highRisk) {
    return 'high-risk-bypass';
  }
  const preservation = validateSemanticPreservation(
    item.literalText,
    item.candidate.adaptedText,
    item.candidate.decision,
  );
  if (!preservation.valid) return 'preservation-fallback';
  return item.candidate.decision === 'literal'
    ? 'accepted-literal'
    : 'accepted';
};

export const evaluateTranscriptAdaptationGuards = (
  corpus: TranscriptAdaptationCorpus,
): TranscriptAdaptationGuardSummary => {
  const outcomes: Record<EvaluationOutcome, number> = {
    accepted: 0,
    'accepted-literal': 0,
    'high-risk-bypass': 0,
    'preservation-fallback': 0,
  };
  const mismatches: string[] = [];
  const latencies: number[] = [];

  for (const item of corpus.cases) {
    const startedAt = performance.now();
    const outcome = evaluateCase(item);
    latencies.push(performance.now() - startedAt);
    outcomes[outcome] += 1;
    if (outcome !== item.expectedOutcome) {
      mismatches.push(item.id);
    }
  }
  latencies.sort((left, right) => left - right);

  return {
    mode: 'guards',
    corpusVersion: corpus.version,
    syntheticOnly: corpus.syntheticOnly,
    total: corpus.cases.length,
    categories: new Set(corpus.cases.map((item) => item.category)).size,
    outcomes,
    mismatches,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? 0,
    },
  };
};

export interface TranscriptAdaptationProviderSummary {
  mode: 'provider';
  corpusVersion: string;
  syntheticOnly: true;
  provider: string;
  model: string;
  total: number;
  locallyBypassed: number;
  modelRiskBypasses: number;
  accepted: number;
  literalDecisions: number;
  semanticFallbacks: number;
  providerErrors: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  latencyMs: {
    p50: number;
    p95: number;
    max: number;
  };
}

export const evaluateTranscriptAdaptationProvider = async (
  corpus: TranscriptAdaptationCorpus,
  provider: TranscriptAdaptationProvider,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<TranscriptAdaptationProviderSummary> => {
  const limit = Math.min(
    corpus.cases.length,
    Math.max(1, Math.trunc(options.limit ?? corpus.cases.length)),
  );
  const selected = corpus.cases.slice(0, limit);
  const latencies: number[] = [];
  let locallyBypassed = 0;
  let modelRiskBypasses = 0;
  let accepted = 0;
  let literalDecisions = 0;
  let semanticFallbacks = 0;
  let providerErrors = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const item of selected) {
    if (detectHighRiskContent(item.literalText).highRisk) {
      locallyBypassed += 1;
      continue;
    }
    try {
      const context = corpus.contextProfiles[item.contextProfile];
      if (!context) {
        providerErrors += 1;
        continue;
      }
      const startedAt = performance.now();
      const result = await provider.adapt(
        {
          literalText: item.literalText,
          language: corpus.language,
          context,
          contextVersion: 0,
          promptVersion: corpus.promptVersion,
        },
        AbortSignal.timeout(options.timeoutMs ?? 15_000),
      );
      latencies.push(performance.now() - startedAt);
      inputTokens += result.usage?.inputTokens ?? 0;
      outputTokens += result.usage?.outputTokens ?? 0;
      if (result.output.risk === 'urgent') {
        modelRiskBypasses += 1;
        continue;
      }
      const preservation = validateSemanticPreservation(
        item.literalText,
        result.output.adaptedText,
        result.output.decision,
      );
      if (!preservation.valid) {
        semanticFallbacks += 1;
        continue;
      }
      accepted += 1;
      if (result.output.decision === 'literal') literalDecisions += 1;
    } catch {
      providerErrors += 1;
    }
  }
  latencies.sort((left, right) => left - right);

  return {
    mode: 'provider',
    corpusVersion: corpus.version,
    syntheticOnly: corpus.syntheticOnly,
    provider: provider.providerName,
    model: provider.modelName,
    total: selected.length,
    locallyBypassed,
    modelRiskBypasses,
    accepted,
    literalDecisions,
    semanticFallbacks,
    providerErrors,
    usage: { inputTokens, outputTokens },
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? 0,
    },
  };
};
