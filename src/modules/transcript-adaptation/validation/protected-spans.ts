export type ProtectedSpans = {
  money: string[];
  percentages: string[];
  dates: string[];
  times: string[];
  measurements: string[];
  phones: string[];
  urls: string[];
  emails: string[];
  identifiers: string[];
  quotedTerms: string[];
  acronyms: string[];
  capitalizedEntities: string[];
  negations: string[];
  modalities: string[];
  numbers: string[];
};

const matches = (text: string, pattern: RegExp, group = 0): string[] =>
  Array.from(text.matchAll(pattern), (match) => match[group]).filter(
    (value): value is string => value !== undefined,
  );

const modalityCategory = (value: string): string => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/nao\s+pode|proibid/.test(normalized)) return 'prohibition';
  if (/deve|precisa|obrigatori/.test(normalized)) return 'obligation';
  return 'permission';
};

export const extractProtectedSpans = (text: string): ProtectedSpans => ({
  money: matches(text, /R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?/giu),
  percentages: matches(text, /\b\d+(?:[.,]\d+)?\s*%/gu),
  dates: matches(text, /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gu),
  times: matches(text, /\b\d{1,2}(?::|h)\d{2}\b/giu),
  measurements: matches(
    text,
    /\b\d+(?:[.,]\d+)?\s*(?:mg|g|kg|ml|l|cm|m|km|°c|ºc)\b/giu,
  ),
  phones: matches(text, /\+?\d{1,3}\s*(?:\(\d{2,3}\)\s*)?\d{4,5}[-\s]?\d{4}/gu),
  urls: matches(text, /https?:\/\/[^\s<>{}"']+/giu),
  emails: matches(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu),
  identifiers: matches(text, /\b[A-Z]{2,}[A-Z0-9]*-\d+\b/gu),
  quotedTerms: [
    ...matches(text, /“([^”]+)”/gu, 1),
    ...matches(text, /"([^"]+)"/gu, 1),
  ],
  acronyms: matches(text, /\b[A-ZÁÉÍÓÚÇ]{2,}\b/gu),
  capitalizedEntities: matches(
    text,
    /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)*\b/gu,
  ),
  negations: matches(text, /\b(?:não|nunca|jamais|sem|nem)\b/giu).map((value) =>
    value.toLocaleLowerCase('pt-BR'),
  ),
  modalities: matches(
    text,
    /\b(?:não\s+pode|é\s+proibid[oa]|proibid[oa]s?|deve|devem|precisa|precisam|obrigatóri[oa]s?|pode|podem|permitid[oa]s?)\b/giu,
  ).map(modalityCategory),
  numbers: matches(text, /\b\d+(?:[.,]\d+)*\b/gu),
});
