export type HighRiskCategory =
  'fire' | 'medical' | 'violence' | 'urgent-command';

export type HighRiskContentResult = {
  highRisk: boolean;
  categories: HighRiskCategory[];
};

const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const CATEGORY_PATTERNS: ReadonlyArray<{
  category: HighRiskCategory;
  pattern: RegExp;
}> = [
  {
    category: 'fire',
    pattern: /\b(?:fogo|incendio|evacue|evacuacao|evacuar)\b/u,
  },
  {
    category: 'medical',
    pattern:
      /\b(?:emergencia medica|sangramento|convulsao|desmaio|parada cardiaca|socorro medico)\b/u,
  },
  {
    category: 'violence',
    pattern: /\b(?:armad[oa]|arma|ameaca|violencia|agressa[oa])\b/u,
  },
  {
    category: 'urgent-command',
    pattern:
      /\b(?:nao toque|perigo|socorro|imediatamente|afaste-se|desligue agora)\b/u,
  },
];

export const detectHighRiskContent = (text: string): HighRiskContentResult => {
  const normalized = normalize(text);
  const categories = CATEGORY_PATTERNS.filter(({ pattern }) =>
    pattern.test(normalized),
  ).map(({ category }) => category);
  return { highRisk: categories.length > 0, categories };
};
