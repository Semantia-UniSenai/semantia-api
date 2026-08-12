import { Injectable } from '@nestjs/common';
import { TranscriptAdaptationProviderResult } from '../contracts/transcript-adaptation.types';
import {
  TranscriptAdaptationProvider,
  TranscriptAdaptationProviderError,
} from './transcript-adaptation.provider';

@Injectable()
export class MisconfiguredTranscriptAdaptationProvider extends TranscriptAdaptationProvider {
  readonly providerName = 'groq';

  constructor(readonly modelName: string) {
    super();
  }

  adapt(): Promise<TranscriptAdaptationProviderResult> {
    return Promise.reject(
      new TranscriptAdaptationProviderError('MISCONFIGURED', false),
    );
  }
}
