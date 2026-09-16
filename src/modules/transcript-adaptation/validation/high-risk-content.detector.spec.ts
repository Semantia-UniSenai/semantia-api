import { detectHighRiskContent } from './high-risk-content.detector';

describe('detectHighRiskContent', () => {
  it.each([
    ['Fogo! Evacue o prédio agora.', 'fire'],
    ['Há uma emergência médica e sangramento intenso.', 'medical'],
    ['Ele está armado e fez uma ameaça.', 'violence'],
    ['Não toque no painel. Perigo de choque elétrico.', 'urgent-command'],
  ])('faz bypass conservador em %s', (text, category) => {
    const result = detectHighRiskContent(text);

    expect(result.highRisk).toBe(true);
    expect(result.categories).toContain(category);
  });

  it('não marca conversa operacional comum', () => {
    expect(
      detectHighRiskContent(
        'A equipe vai revisar o relatório na próxima reunião.',
      ),
    ).toEqual({ highRisk: false, categories: [] });
  });
});
