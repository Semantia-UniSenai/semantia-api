import { extractProtectedSpans } from './protected-spans';

describe('extractProtectedSpans', () => {
  it('extrai invariantes auditáveis sem alterar o texto', () => {
    const spans = extractProtectedSpans(
      'Ana confirmou R$ 1.250,90 e 12,5% em 10/08/2026 às 14h30. ' +
        'Dose 5 mg. Ligue +55 (47) 99999-1234, veja https://semantia.app/a?b=1 ' +
        'ou ana@example.com. Use ABC-42, “Plano Azul” e API.',
    );

    expect(spans.money).toEqual(['R$ 1.250,90']);
    expect(spans.percentages).toEqual(['12,5%']);
    expect(spans.dates).toEqual(['10/08/2026']);
    expect(spans.times).toEqual(['14h30']);
    expect(spans.measurements).toEqual(['5 mg']);
    expect(spans.phones).toEqual(['+55 (47) 99999-1234']);
    expect(spans.urls).toEqual(['https://semantia.app/a?b=1']);
    expect(spans.emails).toEqual(['ana@example.com']);
    expect(spans.identifiers).toContain('ABC-42');
    expect(spans.quotedTerms).toEqual(['Plano Azul']);
    expect(spans.acronyms).toEqual(expect.arrayContaining(['ABC', 'API']));
    expect(spans.capitalizedEntities).toContain('Ana');
  });

  it('mantém multiplicidade para detectar omissão de repetição relevante', () => {
    expect(extractProtectedSpans('Use 42 e confirme 42.').numbers).toEqual([
      '42',
      '42',
    ]);
  });
});
