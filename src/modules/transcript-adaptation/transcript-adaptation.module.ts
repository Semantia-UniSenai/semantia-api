import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import {
  loadTranscriptAdaptationConfig,
  TranscriptAdaptationRuntimeConfig,
} from './config/transcript-adaptation.config';
import { TranscriptAdaptationProvider } from './providers/transcript-adaptation.provider';
import { createTranscriptAdaptationProvider } from './providers/transcript-adaptation-provider.factory';
import { AdaptationCircuitBreaker } from './resilience/circuit-breaker';
import { PrismaTranscriptAdaptationRepository } from './repositories/prisma-transcript-adaptation.repository';
import { TranscriptAdaptationRepository } from './repositories/transcript-adaptation.repository';
import { TranscriptAdaptationCoordinator } from './services/transcript-adaptation-coordinator';
import { TranscriptAdaptationQueue } from './services/transcript-adaptation-queue';
import { TranscriptAdaptationRecoveryService } from './services/transcript-adaptation-recovery.service';
import { AdaptTranscriptSegmentUseCase } from './usecases/adapt-transcript-segment.usecase';

@Module({
  imports: [SessionsModule],
  providers: [
    {
      provide: TranscriptAdaptationRuntimeConfig,
      useFactory: (): TranscriptAdaptationRuntimeConfig =>
        loadTranscriptAdaptationConfig(process.env),
    },
    {
      provide: TranscriptAdaptationRepository,
      useClass: PrismaTranscriptAdaptationRepository,
    },
    {
      provide: TranscriptAdaptationProvider,
      inject: [TranscriptAdaptationRuntimeConfig],
      useFactory: (
        config: TranscriptAdaptationRuntimeConfig,
      ): TranscriptAdaptationProvider =>
        createTranscriptAdaptationProvider(config),
    },
    {
      provide: AdaptationCircuitBreaker,
      inject: [TranscriptAdaptationRuntimeConfig],
      useFactory: (
        config: TranscriptAdaptationRuntimeConfig,
      ): AdaptationCircuitBreaker =>
        new AdaptationCircuitBreaker({
          failureThreshold: config.circuitFailureThreshold,
          resetMs: config.circuitResetMs,
        }),
    },
    {
      provide: TranscriptAdaptationQueue,
      inject: [TranscriptAdaptationRuntimeConfig],
      useFactory: (
        config: TranscriptAdaptationRuntimeConfig,
      ): TranscriptAdaptationQueue =>
        new TranscriptAdaptationQueue({
          maxConcurrency: config.maxConcurrency,
          maxQueue: config.maxQueue,
        }),
    },
    AdaptTranscriptSegmentUseCase,
    TranscriptAdaptationCoordinator,
    TranscriptAdaptationRecoveryService,
  ],
  exports: [TranscriptAdaptationRuntimeConfig, TranscriptAdaptationCoordinator],
})
export class TranscriptAdaptationModule {}
