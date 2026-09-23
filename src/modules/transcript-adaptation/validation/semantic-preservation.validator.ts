import { extractProtectedSpans, ProtectedSpans } from './protected-spans';

export type SemanticPreservationViolation = {
  kind: keyof ProtectedSpans | 'literal-mismatch' | 'expansion-limit';
  expectedCount: number;
  actualCount: number;
};

export type SemanticPreservationResult =
  | { valid: true; violations: [] }
  | { valid: false; violations: SemanticPreservationViolation[] };

const normalize = (value: string): string =>
  value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');

const normalizedMultiset = (values: string[]): string[] =>
  values.map(normalize).sort((left, right) => left.localeCompare(right));

const sameValues = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const validateSemanticPreservation = (
  literalText: string,
  adaptedText: string,
  decision: 'adapted' | 'literal',
): SemanticPreservationResult => {
  if (decision === 'literal') {
    if (literalText === adaptedText) return { valid: true, violations: [] };
    return {
      valid: false,
      violations: [
        {
          kind: 'literal-mismatch',
          expectedCount: literalText.length,
          actualCount: adaptedText.length,
        },
      ],
    };
  }

  const literal = extractProtectedSpans(literalText);
  const adapted = extractProtectedSpans(adaptedText);
  const violations: SemanticPreservationViolation[] = [];

  for (const kind of Object.keys(literal) as (keyof ProtectedSpans)[]) {
    const expected = normalizedMultiset(literal[kind]);
    const actual = normalizedMultiset(adapted[kind]);
    if (!sameValues(expected, actual)) {
      violations.push({
        kind,
        expectedCount: expected.length,
        actualCount: actual.length,
      });
    }
  }

  const maxLength = Math.max(literalText.length * 3, literalText.length + 160);
  if (adaptedText.length > maxLength) {
    violations.push({
      kind: 'expansion-limit',
      expectedCount: maxLength,
      actualCount: adaptedText.length,
    });
  }

  return violations.length === 0
    ? { valid: true, violations: [] }
    : { valid: false, violations };
};
