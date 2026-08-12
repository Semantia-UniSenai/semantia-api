import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { TranscriptAdaptationRepository } from '../repositories/transcript-adaptation.repository';

export const TRANSCRIPT_ADAPTATION_NOW = Symbol('TRANSCRIPT_ADAPTATION_NOW');

@Injectable()
export class TranscriptAdaptationRecoveryService implements OnApplicationBootstrap {
  private readonly currentTime: () => Date;

  constructor(
    private readonly adaptations: TranscriptAdaptationRepository,
    @Optional()
    @Inject(TRANSCRIPT_ADAPTATION_NOW)
    now?: () => Date,
  ) {
    this.currentTime = now ?? (() => new Date());
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.adaptations.markStalePendingAsFallback(this.currentTime());
  }
}
