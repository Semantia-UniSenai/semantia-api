import { Module } from '@nestjs/common';
import { TranscriptAdaptationModule } from '../transcript-adaptation/transcript-adaptation.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TranscriptAdaptationModule],
  controllers: [HealthController],
})
export class HealthModule {}
