/**
 * Limpeza barata (regex) de disfluências da fala — remove palavras de vício
 * e repetições antes de a frase final ser persistida e retransmitida para a
 * sala. É a primeira camada da adaptação semântica do Semantia; a camada de
 * LLM (`transcript:adapted`) virá depois dela, sobre este texto já limpo.
 *
 * Conservadora de propósito: só cai fora o que é ruído inequívoco como
 * palavra isolada ("né", "aham", "ééé"). Palavras ambíguas ("tipo", "então",
 * "assim") ficam — cortá-las mudaria frases legítimas ("tipo de dado").
 */

/**
 * Hesitações vocalizadas que não carregam conteúdo semântico.
 */
const HESITATION_PATTERNS: readonly string[] = [
  'é{2,}',
  'ã+h*',
  'hã+',
  'hum+',
  'aham+',
  'uhum+',
  'ahn+',
  'ehn+',
];

/**
 * Vocabulário público da estratégia. Marcadores compostos só são removidos
 * quando a pontuação prova seu uso discursivo; não entram na regex geral.
 */
export const FILLER_PATTERNS: readonly string[] = [
  ...HESITATION_PATTERNS,
  'né',
  'tá ligado',
  'tipo assim',
];

const HESITATION_REGEX = new RegExp(
  `(?<!\\p{L})(?:${HESITATION_PATTERNS.join('|')})(?!\\p{L})(?:[.,!?;:]+)?`,
  'giu',
);

const LOWERCASE_NE_REGEX = /(?<!\p{L})né(?!\p{L})(?:[.,!?;:]+)?/gu;

// Expressões ambíguas e `Né` só caem no início quando a pontuação prova
// seu uso discursivo. O grupo externo consome marcadores empilhados em uma
// única passagem, sem loop de substituição.
const INITIAL_DISCOURSE_MARKER_REGEX =
  /^(?:(?:Né|tipo assim|tá ligado)\s*[,!?;:]+\s*)+/iu;
const PUNCTUATED_DISCOURSE_MARKER_REGEX =
  /(?<=[,!?;:])\s*(?:tipo assim|tá ligado)\s*[,!?;:]+\s*/giu;

// Gagueira/repetição imediata da mesma palavra: "o o o professor" → "o professor".
const REPEATED_WORD_REGEX = /(?<!\p{L})(\p{L}+)(?:\s+\1(?!\p{L}))+/giu;
const NUMBER_WORDS = new Set([
  'zero',
  'um',
  'uma',
  'dois',
  'duas',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'catorze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
  'cem',
  'cento',
  'mil',
  'milhão',
  'milhões',
]);

// Pontuação órfã deixada pela remoção: " ," → ",", ",," → ",".
const ORPHAN_SPACE_REGEX = /\s+([.,!?;:])/g;
const DOUBLED_PUNCT_REGEX = /([.,!?;:])(?:\s*[,;:])+/g;
const LEADING_ORPHAN_PUNCT_REGEX = /^[,!?;:]+\s*/;

export const CURRENT_TRANSCRIPT_CLEANING_STRATEGY =
  'pt-br-conservative-v1' as const;

export interface CanonicalTranscript {
  text: string;
  cleaningStrategyVersion: typeof CURRENT_TRANSCRIPT_CLEANING_STRATEGY;
}

/**
 * Produz o único texto literal canônico e identifica a estratégia determinística
 * usada. O texto reconhecido pelo ASR continua restrito à memória da chamada.
 */
export function cleanCanonicalTranscript(text: string): CanonicalTranscript {
  return {
    text: stripDisfluencies(text),
    cleaningStrategyVersion: CURRENT_TRANSCRIPT_CLEANING_STRATEGY,
  };
}

/**
 * Remove vícios e repetições de `text`. Pode devolver string vazia quando a
 * frase inteira era ruído ("né?") — o chamador decide não persistir nesse caso.
 */
export function stripDisfluencies(text: string): string {
  const withoutUnambiguousFillers = text
    .replace(HESITATION_REGEX, '')
    .replace(LOWERCASE_NE_REGEX, '')
    .replace(/^\s+/u, '');

  const clean = withoutUnambiguousFillers
    .replace(INITIAL_DISCOURSE_MARKER_REGEX, '')
    .replace(PUNCTUATED_DISCOURSE_MARKER_REGEX, ' ')
    .replace(REPEATED_WORD_REGEX, (repetition: string, word: string) =>
      NUMBER_WORDS.has(word.toLocaleLowerCase('pt-BR')) ? repetition : word,
    )
    .replace(ORPHAN_SPACE_REGEX, '$1')
    .replace(DOUBLED_PUNCT_REGEX, '$1')
    .replace(LEADING_ORPHAN_PUNCT_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Sobrou só pontuação ("né?" → "?"): a frase inteira era ruído.
  return /[\p{L}\p{N}]/u.test(clean) ? clean : '';
}
