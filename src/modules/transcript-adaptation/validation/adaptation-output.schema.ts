import { z } from 'zod';

export const adaptationOutputSchema = z
  .object({
    adaptedText: z.string().min(1).max(5_000),
    decision: z.enum(['adapted', 'literal']),
    risk: z.enum(['none', 'urgent', 'ambiguous', 'preservation-risk']),
  })
  .strict();

export type AdaptationOutput = z.infer<typeof adaptationOutputSchema>;

export const parseAdaptationOutput = (value: unknown): AdaptationOutput =>
  adaptationOutputSchema.parse(value);

export const adaptationOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['adaptedText', 'decision', 'risk'],
  properties: {
    adaptedText: { type: 'string', minLength: 1, maxLength: 5_000 },
    decision: { type: 'string', enum: ['adapted', 'literal'] },
    risk: {
      type: 'string',
      enum: ['none', 'urgent', 'ambiguous', 'preservation-risk'],
    },
  },
} as const;
