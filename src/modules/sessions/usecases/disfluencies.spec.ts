import {
  DISCARD_CASES,
  PRESERVATION_CASES,
  REMOVAL_CASES,
} from '../testing/transcript-cleaning.corpus';
import { cleanCanonicalTranscript, stripDisfluencies } from './disfluencies';

describe('cleanCanonicalTranscript', () => {
  it('returns the canonical text with its immutable strategy version', () => {
    expect(cleanCanonicalTranscript('né? hoje hoje aula')).toEqual({
      text: 'hoje aula',
      cleaningStrategyVersion: 'pt-br-conservative-v1',
    });
  });

  it.each([...REMOVAL_CASES, ...PRESERVATION_CASES])(
    '$name',
    ({ input, expected }) => {
      expect(cleanCanonicalTranscript(input).text).toBe(expected);
    },
  );

  it.each(DISCARD_CASES)('descarta ruído puro: %s', (input) => {
    expect(cleanCanonicalTranscript(input).text).toBe('');
  });

  it('is deterministic for the same input and strategy', () => {
    const input = 'ééé... né? ação ação acessível';
    const first = cleanCanonicalTranscript(input);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(cleanCanonicalTranscript(input)).toEqual(first);
    }
  });
});

describe('stripDisfluencies', () => {
  it('remove marcadores de vício isolados', () => {
    expect(stripDisfluencies('hoje né vamos falar de frações')).toBe(
      'hoje vamos falar de frações',
    );
    expect(stripDisfluencies('isso é importante, tá ligado, pessoal')).toBe(
      'isso é importante, pessoal',
    );
  });

  it('remove hesitações vocalizadas, inclusive alongadas', () => {
    expect(stripDisfluencies('ééé o resultado é dez')).toBe(
      'o resultado é dez',
    );
    expect(stripDisfluencies('a resposta hum é quatro')).toBe(
      'a resposta é quatro',
    );
    expect(stripDisfluencies('ãh vamos começar')).toBe('vamos começar');
  });

  it('colapsa repetições imediatas da mesma palavra (gagueira)', () => {
    expect(stripDisfluencies('o o o professor chegou')).toBe(
      'o professor chegou',
    );
    expect(stripDisfluencies('vamos vamos começar')).toBe('vamos começar');
  });

  it('NÃO corta palavras legítimas parecidas com vícios', () => {
    // "é" sozinho é verbo; "tipo" sozinho pode ser substantivo.
    expect(stripDisfluencies('isso é um tipo de dado')).toBe(
      'isso é um tipo de dado',
    );
    // Vício no meio de palavra maior não casa (limites unicode).
    expect(stripDisfluencies('o hummus é uma pasta')).toBe(
      'o hummus é uma pasta',
    );
  });

  it('limpa pontuação órfã e espaços duplicados após a remoção', () => {
    expect(stripDisfluencies('hoje, né, vamos estudar')).toBe(
      'hoje, vamos estudar',
    );
  });

  it('frase que era só ruído vira string vazia', () => {
    expect(stripDisfluencies('né')).toBe('');
    expect(stripDisfluencies('ééé hum')).toBe('');
    // Pontuação órfã de ruído não sobrevive sozinha.
    expect(stripDisfluencies('né?')).toBe('');
    expect(stripDisfluencies('ééé hum!')).toBe('');
  });
});
