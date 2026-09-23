import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const audienceContextSchema = z
  .object({
    meetingType: z.enum([
      'escola',
      'empresa',
      'palestra',
      'evento',
      'comunidade',
    ]),
    ageRange: z.enum(['criancas', 'adolescentes', 'adultos', 'misto']),
    portugueseFamiliarity: z.enum(['baixa', 'media', 'alta']),
    domain: z.string().min(1),
    simplificationLevel: z.enum(['leve', 'moderada', 'alta']),
  })
  .strict();

const corpusCaseSchema = z
  .object({
    id: z.string().min(1),
    category: z.string().min(1),
    contextProfile: z.string().min(1),
    literalText: z.string().min(1).max(5_000),
    candidate: z
      .object({
        adaptedText: z.string().min(1).max(5_000),
        decision: z.enum(['adapted', 'literal']),
        risk: z.enum(['none', 'urgent']),
      })
      .strict(),
    expectedOutcome: z.enum([
      'accepted',
      'accepted-literal',
      'high-risk-bypass',
      'preservation-fallback',
    ]),
  })
  .strict();

const transcriptAdaptationCorpusSchema = z
  .object({
    version: z.string().min(1),
    language: z.literal('pt-BR'),
    promptVersion: z.literal('pt-br-accessible-v1'),
    syntheticOnly: z.literal(true),
    contextProfiles: z.record(z.string().min(1), audienceContextSchema),
    cases: z.array(corpusCaseSchema).min(100),
  })
  .strict();

export type TranscriptAdaptationCorpus = z.infer<
  typeof transcriptAdaptationCorpusSchema
>;
export type TranscriptAdaptationCorpusCase = z.infer<typeof corpusCaseSchema>;

export const loadTranscriptAdaptationCorpus = (
  path = join(__dirname, 'transcript-adaptation-corpus.synthetic.json'),
): TranscriptAdaptationCorpus =>
  transcriptAdaptationCorpusSchema.parse(
    JSON.parse(readFileSync(path, 'utf8')) as unknown,
  );
