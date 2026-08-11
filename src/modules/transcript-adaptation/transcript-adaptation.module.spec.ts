import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../../database/prisma.module';
import { TranscriptAdaptationRuntimeConfig } from './config/transcript-adaptation.config';
import { DisabledTranscriptAdaptationProvider } from './providers/disabled-transcript-adaptation.provider';
import { TranscriptAdaptationProvider } from './providers/transcript-adaptation.provider';
import { TranscriptAdaptationCoordinator } from './services/transcript-adaptation-coordinator';
import { TranscriptAdaptationModule } from './transcript-adaptation.module';

describe('TranscriptAdaptationModule', () => {
  it('compõe o pipeline desabilitado por padrão sem cliente externo', async () => {
    const previousEnabled = process.env.TRANSCRIPT_ADAPTATION_ENABLED;
    const previousProvider = process.env.TRANSCRIPT_ADAPTATION_PROVIDER;
    delete process.env.TRANSCRIPT_ADAPTATION_ENABLED;
    delete process.env.TRANSCRIPT_ADAPTATION_PROVIDER;

    try {
      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                DATABASE_URL:
                  'postgresql://semantia:semantia@127.0.0.1:5432/semantia_module_test',
                JWT_SECRET:
                  'synthetic-module-test-secret-at-least-32-characters',
              }),
            ],
          }),
          PrismaModule,
          TranscriptAdaptationModule,
        ],
      }).compile();

      expect(moduleRef.get(TranscriptAdaptationCoordinator)).toBeDefined();
      expect(moduleRef.get(TranscriptAdaptationProvider)).toBeInstanceOf(
        DisabledTranscriptAdaptationProvider,
      );
      expect(
        moduleRef.get(TranscriptAdaptationRuntimeConfig).toPublicState(),
      ).toMatchObject({
        enabled: false,
        provider: 'disabled',
        state: 'disabled',
      });
      await moduleRef.close();
    } finally {
      if (previousEnabled === undefined)
        delete process.env.TRANSCRIPT_ADAPTATION_ENABLED;
      else process.env.TRANSCRIPT_ADAPTATION_ENABLED = previousEnabled;
      if (previousProvider === undefined)
        delete process.env.TRANSCRIPT_ADAPTATION_PROVIDER;
      else process.env.TRANSCRIPT_ADAPTATION_PROVIDER = previousProvider;
    }
  });
});
