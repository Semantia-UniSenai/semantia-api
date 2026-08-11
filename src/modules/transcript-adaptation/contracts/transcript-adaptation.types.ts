import { AudienceContext } from '../../sessions/entities/audience-context.entity';
import { AdaptationOutput } from '../validation/adaptation-output.schema';

export type TranscriptAdaptationInput = {
  literalText: string;
  language: 'pt-BR';
  contextVersion: number;
  context: AudienceContext;
  promptVersion: string;
};

export type TranscriptAdaptationUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
};

export type TranscriptAdaptationProviderResult = {
  output: AdaptationOutput;
  provider: string;
  model: string;
  usage: TranscriptAdaptationUsage;
};
