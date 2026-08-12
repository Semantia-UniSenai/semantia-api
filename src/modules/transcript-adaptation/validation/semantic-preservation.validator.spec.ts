import { validateSemanticPreservation } from './semantic-preservation.validator';

describe('validateSemanticPreservation', () => {
  it('aceita segmentação diferente quando invariantes permanecem', () => {
    expect(
      validateSemanticPreservation(
        'Ana deve pagar R$ 1.250,90 até 10/08/2026 às 14h30.',
        'Ana precisa pagar R$ 1.250,90. O prazo é 10/08/2026, às 14h30.',
        'adapted',
      ),
    ).toEqual({ valid: true, violations: [] });
  });

  it.each([
    {
      name: 'dinheiro',
      literal: 'Pague R$ 1.250,90.',
      adapted: 'Pague R$ 1.250,00.',
    },
    {
      name: 'percentual',
      literal: 'O índice caiu 12,5%.',
      adapted: 'O índice caiu 10%.',
    },
    {
      name: 'data',
      literal: 'Entregue em 10/08/2026.',
      adapted: 'Entregue em 11/08/2026.',
    },
    {
      name: 'horário',
      literal: 'Chegue às 14h30.',
      adapted: 'Chegue às 15h30.',
    },
    {
      name: 'unidade',
      literal: 'A dose é 5 mg.',
      adapted: 'A dose é 50 mg.',
    },
    {
      name: 'nome e sigla',
      literal: 'João Silva aprovou a API.',
      adapted: 'João Souza aprovou o sistema.',
    },
    {
      name: 'termo citado',
      literal: 'Use o procedimento “Plano Azul”.',
      adapted: 'Use o procedimento Plano Verde.',
    },
  ])('rejeita alteração de $name', ({ literal, adapted }) => {
    const result = validateSemanticPreservation(literal, adapted, 'adapted');

    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it.each([
    ['Não desligue o alarme.', 'Desligue o alarme.'],
    ['Desligue o alarme.', 'Não desligue o alarme.'],
    ['Você deve sair.', 'Você pode sair.'],
    ['É proibido entrar.', 'Evite entrar.'],
  ])('rejeita inversão de negação ou modalidade: %s', (literal, adapted) => {
    expect(
      validateSemanticPreservation(literal, adapted, 'adapted'),
    ).toMatchObject({ valid: false });
  });

  it('rejeita item protegido novo', () => {
    const result = validateSemanticPreservation(
      'A reunião começa agora.',
      'A reunião começa às 15h30 com Ana.',
      'adapted',
    );

    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: expect.any(String) }),
      ]),
    );
  });

  it('exige igualdade exata quando decision é literal', () => {
    expect(
      validateSemanticPreservation(
        'Texto literal.',
        'Texto literal!',
        'literal',
      ),
    ).toMatchObject({ valid: false });
    expect(
      validateSemanticPreservation(
        'Texto literal.',
        'Texto literal.',
        'literal',
      ),
    ).toEqual({ valid: true, violations: [] });
  });
});
