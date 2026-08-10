export interface TranscriptCleaningCase {
  name: string;
  input: string;
  expected: string;
}

export const REMOVAL_CASES: readonly TranscriptCleaningCase[] = [
  {
    name: 'remove né e repetição sem deixar interrogação órfã',
    input: 'né? hoje hoje aula',
    expected: 'hoje aula',
  },
  {
    name: 'remove marcador composto no início quando pontuado como hesitação',
    input: 'tipo assim, precisamos revisar',
    expected: 'precisamos revisar',
  },
  {
    name: 'remove marcador composto entre vírgulas',
    input: 'isso é importante, tá ligado, pessoal',
    expected: 'isso é importante, pessoal',
  },
  {
    name: 'remove marcadores empilhados no início sem loop',
    input: 'Né, tipo assim, tá ligado, precisamos revisar',
    expected: 'precisamos revisar',
  },
  {
    name: 'remove hesitação alongada e a pontuação anexada',
    input: 'ééé... comunicação acessível',
    expected: 'comunicação acessível',
  },
  {
    name: 'colapsa repetição imediata com Unicode',
    input: 'ação ação acessível',
    expected: 'ação acessível',
  },
];

export const PRESERVATION_CASES: readonly TranscriptCleaningCase[] = [
  {
    name: 'preserva tipo como substantivo',
    input: 'Esse é um tipo de dado.',
    expected: 'Esse é um tipo de dado.',
  },
  {
    name: 'preserva bom em saudação',
    input: 'Bom dia, equipe.',
    expected: 'Bom dia, equipe.',
  },
  {
    name: 'preserva então como conectivo lógico',
    input: 'Se chover, então ficaremos em casa.',
    expected: 'Se chover, então ficaremos em casa.',
  },
  {
    name: 'preserva assim como advérbio',
    input: 'Faça assim para concluir.',
    expected: 'Faça assim para concluir.',
  },
  {
    name: 'preserva sabe como verbo',
    input: 'Você sabe a resposta.',
    expected: 'Você sabe a resposta.',
  },
  {
    name: 'preserva nome próprio semelhante a marcador',
    input: 'Ana Né apresentou o trabalho.',
    expected: 'Ana Né apresentou o trabalho.',
  },
  {
    name: 'preserva expressão composta quando ela qualifica conteúdo',
    input: 'O tipo assim definido é seguro.',
    expected: 'O tipo assim definido é seguro.',
  },
  {
    name: 'preserva tá ligado no sentido literal',
    input: 'O sensor tá ligado na tomada.',
    expected: 'O sensor tá ligado na tomada.',
  },
  {
    name: 'preserva repetição pontuada como ênfase ou correção',
    input: 'Não, não faça isso.',
    expected: 'Não, não faça isso.',
  },
  {
    name: 'preserva números repetidos',
    input: 'O ano foi vinte vinte.',
    expected: 'O ano foi vinte vinte.',
  },
  {
    name: 'preserva substring semelhante a hesitação',
    input: 'O hummus é uma pasta.',
    expected: 'O hummus é uma pasta.',
  },
];

export const DISCARD_CASES: readonly string[] = [
  'né',
  'né?',
  'ééé hum!',
  'ãh...',
];
