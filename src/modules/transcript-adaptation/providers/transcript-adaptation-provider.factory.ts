import Groq from 'groq-sdk';
import { TranscriptAdaptationRuntimeConfig } from '../config/transcript-adaptation.config';
import { DisabledTranscriptAdaptationProvider } from './disabled-transcript-adaptation.provider';
import { FakeTranscriptAdaptationProvider } from './fake-transcript-adaptation.provider';
import {
  GroqChatCompletionsClient,
  GroqTranscriptAdaptationProvider,
} from './groq-transcript-adaptation.provider';
import { MisconfiguredTranscriptAdaptationProvider } from './misconfigured-transcript-adaptation.provider';
import { TranscriptAdaptationProvider } from './transcript-adaptation.provider';

export type CreateGroqClientOptions = {
  apiKey: string;
  maxRetries: number;
  timeout: number;
};

export type TranscriptAdaptationProviderFactoryDependencies = {
  createGroqClient?: (
    options: CreateGroqClientOptions,
  ) => GroqChatCompletionsClient;
};

const defaultCreateGroqClient = (
  options: CreateGroqClientOptions,
): GroqChatCompletionsClient => new Groq(options).chat.completions;

export const createTranscriptAdaptationProvider = (
  config: TranscriptAdaptationRuntimeConfig,
  dependencies: TranscriptAdaptationProviderFactoryDependencies = {},
): TranscriptAdaptationProvider => {
  const publicState = config.toPublicState();
  if (publicState.state === 'disabled') {
    return new DisabledTranscriptAdaptationProvider();
  }
  if (publicState.state === 'misconfigured') {
    return new MisconfiguredTranscriptAdaptationProvider(config.model);
  }
  if (config.provider === 'fake') {
    return new FakeTranscriptAdaptationProvider({ mode: 'success' });
  }

  const apiKey = config.getGroqApiKey();
  if (!apiKey) {
    return new MisconfiguredTranscriptAdaptationProvider(config.model);
  }
  const createGroqClient =
    dependencies.createGroqClient ?? defaultCreateGroqClient;
  return new GroqTranscriptAdaptationProvider(
    createGroqClient({ apiKey, maxRetries: 0, timeout: config.timeoutMs }),
    config,
  );
};
