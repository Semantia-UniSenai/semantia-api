export const AsrAdaptationInputQuality = {
  ACCEPTABLE: 'ACCEPTABLE',
  SUSPECT_DENSITY: 'SUSPECT_DENSITY',
} as const;

export type AsrAdaptationInputQuality =
  (typeof AsrAdaptationInputQuality)[keyof typeof AsrAdaptationInputQuality];

export const MAX_PLAUSIBLE_SPEECH_WORDS_PER_MINUTE = 360;

export const assessAsrAdaptationInputQuality = (
  text: string,
  durationMs: number,
): AsrAdaptationInputQuality => {
  const wordCount = text.trim() ? text.trim().split(/\s+/u).length : 0;
  const wordsPerMinute = (wordCount * 60_000) / durationMs;
  return wordsPerMinute > MAX_PLAUSIBLE_SPEECH_WORDS_PER_MINUTE
    ? AsrAdaptationInputQuality.SUSPECT_DENSITY
    : AsrAdaptationInputQuality.ACCEPTABLE;
};
