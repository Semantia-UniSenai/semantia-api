import { loadTranscriptAdaptationCorpus } from './transcript-adaptation-corpus';
import { detectHighRiskContent } from '../validation/high-risk-content.detector';
import { validateSemanticPreservation } from '../validation/semantic-preservation.validator';

const requiredCategories = [
  'names',
  'numbers',
  'percentages',
  'money',
  'dates',
  'times',
  'negations',
  'conditions',
  'instructions',
  'commands',
  'alerts',
  'urgency',
  'technical-terms',
  'ambiguities',
  'keep-literal',
] as const;

describe('transcript adaptation synthetic corpus', () => {
  it('possui ao menos 100 casos sintéticos únicos e todas as categorias mínimas', () => {
    const corpus = loadTranscriptAdaptationCorpus();
    const ids = new Set(corpus.cases.map((item) => item.id));
    const categories = new Set(corpus.cases.map((item) => item.category));

    expect(corpus.syntheticOnly).toBe(true);
    expect(corpus.language).toBe('pt-BR');
    expect(corpus.promptVersion).toBe('pt-br-accessible-v1');
    expect(corpus.cases.length).toBeGreaterThanOrEqual(100);
    expect(ids.size).toBe(corpus.cases.length);
    expect(
      requiredCategories.every((category) => categories.has(category)),
    ).toBe(true);
    expect(Object.keys(corpus.contextProfiles)).toHaveLength(5);
  });

  it('faz cada expectativa coincidir com os guardas determinísticos', () => {
    const corpus = loadTranscriptAdaptationCorpus();
    const mismatches: string[] = [];

    for (const item of corpus.cases) {
      const highRisk = detectHighRiskContent(item.literalText).highRisk;
      const preservation = validateSemanticPreservation(
        item.literalText,
        item.candidate.adaptedText,
        item.candidate.decision,
      );
      const actual = highRisk
        ? 'high-risk-bypass'
        : preservation.valid
          ? item.candidate.decision === 'literal'
            ? 'accepted-literal'
            : 'accepted'
          : 'preservation-fallback';
      if (actual !== item.expectedOutcome) {
        mismatches.push(
          `${item.id}: expected=${item.expectedOutcome} actual=${actual}`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('usa somente perfis declarados e endereços reservados de exemplo', () => {
    const corpus = loadTranscriptAdaptationCorpus();
    const profileNames = new Set(Object.keys(corpus.contextProfiles));

    expect(
      corpus.cases.every((item) => profileNames.has(item.contextProfile)),
    ).toBe(true);
    const serialized = JSON.stringify(corpus);
    expect(serialized).not.toMatch(/gsk_|Bearer\s+|GROQ_API_KEY/i);
    for (const email of serialized.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g) ??
      []) {
      expect(
        email.endsWith('@exemplo.org') || email.endsWith('@exemplo.com'),
      ).toBe(true);
    }
  });
});
