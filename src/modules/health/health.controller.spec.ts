import { PrismaService } from '../../database/prisma.service';
import { loadTranscriptAdaptationConfig } from '../transcript-adaptation/config/transcript-adaptation.config';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('expõe estado operacional da adaptação sem razão de secret ou chave', async () => {
    const prisma = {
      isHealthy: jest.fn().mockResolvedValue(true),
    } as unknown as PrismaService;
    const config = loadTranscriptAdaptationConfig({
      TRANSCRIPT_ADAPTATION_ENABLED: 'true',
      TRANSCRIPT_ADAPTATION_PROVIDER: 'groq',
      TRANSCRIPT_ADAPTATION_MODEL: 'openai/gpt-oss-20b',
    });
    const controller = new HealthController(prisma, config);

    const response = await controller.getHealth();

    expect(response).toEqual({
      status: 'ok',
      db: true,
      transcriptAdaptation: {
        enabled: true,
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        promptVersion: 'pt-br-accessible-v1',
        state: 'misconfigured',
      },
    });
    expect(JSON.stringify(response)).not.toMatch(/api.?key|secret|reason/i);
  });
});
