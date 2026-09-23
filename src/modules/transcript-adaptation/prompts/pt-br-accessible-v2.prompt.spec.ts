import { buildPtBrAccessibleV2Prompt } from './pt-br-accessible-v2.prompt';

const base = {
  literalText: 'O responsável deve entregar o relatório amanhã.',
  language: 'pt-BR' as const,
  contextVersion: 4,
  context: {
    meetingType: 'empresa' as const,
    ageRange: 'adultos' as const,
    portugueseFamiliarity: 'media' as const,
    domain: 'Planejamento interno confidencial',
    simplificationLevel: 'moderada' as const,
  },
};

describe('pt-br-accessible-v2 prompt', () => {
  it.each([
    ['leve', 'Mantenha a terminologia técnica'],
    ['moderada', 'Use frases mais curtas'],
    ['alta', 'Use estrutura direta e vocabulário cotidiano'],
  ] as const)('traduz simplificação %s em regra executável', (level, rule) => {
    const prompt = buildPtBrAccessibleV2Prompt({
      ...base,
      context: { ...base.context, simplificationLevel: level },
    });

    expect(prompt.system).toContain(rule);
  });

  it('explicita familiaridade, faixa, tipo e limite do domínio sem promover dados a instrução', () => {
    const prompt = buildPtBrAccessibleV2Prompt(base);

    expect(prompt.version).toBe('pt-br-accessible-v2');
    expect(prompt.system).toContain('Familiaridade média');
    expect(prompt.system).toContain('Público adulto');
    expect(prompt.system).toContain('Contexto empresarial');
    expect(prompt.system).toContain(
      'O domínio serve somente para preservar terminologia',
    );
    expect(prompt.system).not.toContain(base.context.domain);
    expect(prompt.user).toContain(base.context.domain);
    expect(prompt.user).toContain('DADOS_NAO_CONFIAVEIS');
  });
});
