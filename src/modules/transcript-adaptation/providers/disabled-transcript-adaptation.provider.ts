import { Injectable } from '@nestjs/common';
import { TranscriptAdaptationProviderResult } from '../contracts/transcript-adaptation.types';
import {
  TranscriptAdaptationProvider,
  TranscriptAdaptationProviderError,
} from './transcript-adaptation.provider';

@Injectable()
export class DisabledTranscriptAdaptationProvider extends TranscriptAdaptationProvider {
  readonly providerName = 'disabled';
  readonly modelName = 'disabled';

  adapt(): Promise<TranscriptAdaptationProviderResult> {
    return Promise.reject(
      new TranscriptAdaptationProviderError('DISABLED', false),
    );
  }
}
