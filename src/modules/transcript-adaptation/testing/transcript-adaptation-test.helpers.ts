import { TranscriptAdaptationInput } from '../contracts/transcript-adaptation.types';
import { PT_BR_ACCESSIBLE_PROMPT_VERSION } from '../prompts/pt-br-accessible-v1.prompt';

export const buildTranscriptAdaptationTestInput = (
  overrides: Partial<TranscriptAdaptationInput> = {},
): TranscriptAdaptationInput => ({
  literalText: 'A reunião começa às 14h30.',
  language: 'pt-BR',
  contextVersion: 1,
  context: {
    meetingType: 'empresa',
    ageRange: 'adultos',
    portugueseFamiliarity: 'media',
    domain: 'Planejamento',
    simplificationLevel: 'moderada',
  },
  promptVersion: PT_BR_ACCESSIBLE_PROMPT_VERSION,
  ...overrides,
});
