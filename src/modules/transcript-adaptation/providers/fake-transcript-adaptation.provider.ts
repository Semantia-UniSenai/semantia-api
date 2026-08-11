import { Injectable } from '@nestjs/common';
import {
  TranscriptAdaptationInput,
  TranscriptAdaptationProviderResult,
} from '../contracts/transcript-adaptation.types';
import { AdaptationOutput } from '../validation/adaptation-output.schema';
import {
  TranscriptAdaptationProvider,
  TranscriptAdaptationProviderError,
} from './transcript-adaptation.provider';

export type FakeTranscriptAdaptationMode =
  'success' | 'timeout' | 'error' | 'invalid-response';

export type FakeTranscriptAdaptationOptions = {
  mode: FakeTranscriptAdaptationMode;
  output?: AdaptationOutput;
};

@Injectable()
export class FakeTranscriptAdaptationProvider extends TranscriptAdaptationProvider {
  readonly providerName = 'fake';
  readonly modelName = 'fake-deterministic-v1';
  readonly inputs: TranscriptAdaptationInput[] = [];
  callCount = 0;

  constructor(private readonly options: FakeTranscriptAdaptationOptions) {
    super();
  }

  adapt(
    input: TranscriptAdaptationInput,
    signal: AbortSignal,
  ): Promise<TranscriptAdaptationProviderResult> {
    this.callCount += 1;
    this.inputs.push(input);

    if (this.options.mode === 'timeout') {
      return new Promise((_, reject) => {
        const rejectTimeout = () =>
          reject(new TranscriptAdaptationProviderError('TIMEOUT', true));
        if (signal.aborted) {
          rejectTimeout();
          return;
        }
        signal.addEventListener('abort', rejectTimeout, { once: true });
      });
    }

    if (this.options.mode === 'error') {
      return Promise.reject(
        new TranscriptAdaptationProviderError('PROVIDER_ERROR', false),
      );
    }

    if (this.options.mode === 'invalid-response') {
      return Promise.reject(
        new TranscriptAdaptationProviderError('INVALID_RESPONSE', false),
      );
    }

    return Promise.resolve({
      output: this.options.output ?? {
        adaptedText: input.literalText,
        decision: 'literal',
        risk: 'none',
      },
      provider: this.providerName,
      model: this.modelName,
      usage: {
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
      },
    });
  }
}
