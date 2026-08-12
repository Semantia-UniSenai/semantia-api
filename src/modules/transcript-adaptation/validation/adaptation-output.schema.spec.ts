import {
  adaptationOutputJsonSchema,
  parseAdaptationOutput,
} from './adaptation-output.schema';

describe('adaptation output schema', () => {
  const valid = {
    adaptedText: 'A reunião começa às 14h30.',
    decision: 'adapted',
    risk: 'none',
  };

  it('aceita apenas a saída mínima válida', () => {
    expect(parseAdaptationOutput(valid)).toEqual(valid);
  });

  it.each<{ payload: unknown; label: string }>([
    {
      payload: { ...valid, extra: 'não permitido' },
      label: 'propriedade extra',
    },
    { payload: { ...valid, decision: 'summary' }, label: 'decision inválida' },
    { payload: { ...valid, risk: 'safe' }, label: 'risk inválido' },
    { payload: { ...valid, adaptedText: '' }, label: 'texto vazio' },
    {
      payload: { ...valid, adaptedText: 'a'.repeat(5_001) },
      label: 'texto grande',
    },
  ])('rejeita $label', ({ payload }) => {
    expect(() => parseAdaptationOutput(payload)).toThrow();
  });

  it('publica JSON Schema estrito com campos requeridos', () => {
    expect(adaptationOutputJsonSchema).toMatchObject({
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
    });
  });
});
