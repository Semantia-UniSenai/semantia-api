import { Injectable } from '@nestjs/common';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from 'groq-sdk/resources/chat/completions';
import { TranscriptAdaptationRuntimeConfig } from '../config/transcript-adaptation.config';
import {
  TranscriptAdaptationInput,
  TranscriptAdaptationProviderResult,
} from '../contracts/transcript-adaptation.types';
import { buildPtBrAccessibleV1Prompt } from '../prompts/pt-br-accessible-v1.prompt';
import { buildPtBrAccessibleV2Prompt } from '../prompts/pt-br-accessible-v2.prompt';
import {
  adaptationOutputJsonSchema,
  parseAdaptationOutput,
} from '../validation/adaptation-output.schema';
import { mapTranscriptAdaptationProviderError } from './provider-error.mapper';
import {
  TranscriptAdaptationProvider,
  TranscriptAdaptationProviderError,
} from './transcript-adaptation.provider';

export type GroqChatCompletionsClient = {
  create(
    body: ChatCompletionCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): PromiseLike<ChatCompletion>;
};

@Injectable()
export class GroqTranscriptAdaptationProvider extends TranscriptAdaptationProvider {
  readonly providerName = 'groq';
  readonly modelName: string;

  constructor(
    private readonly completions: GroqChatCompletionsClient,
    private readonly config: TranscriptAdaptationRuntimeConfig,
  ) {
    super();
    this.modelName = config.model;
  }

  async adapt(
    input: TranscriptAdaptationInput,
    signal: AbortSignal,
  ): Promise<TranscriptAdaptationProviderResult> {
    const prompt =
      this.config.promptVersion === 'pt-br-accessible-v1'
        ? buildPtBrAccessibleV1Prompt(input)
        : buildPtBrAccessibleV2Prompt(input);
    let completion: ChatCompletion;
    try {
      completion = await this.completions.create(
        {
          model: this.config.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          stream: false,
          n: 1,
          temperature: this.config.temperature,
          max_completion_tokens: this.config.maxOutputTokens,
          include_reasoning: false,
          reasoning_effort: 'low',
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'transcript_adaptation',
              strict: true,
              schema: adaptationOutputJsonSchema,
            },
          },
        },
        { signal },
      );
    } catch (error) {
      throw mapTranscriptAdaptationProviderError(error);
    }

    const content = completion.choices[0]?.message.content;
    if (typeof content !== 'string') {
      throw new TranscriptAdaptationProviderError('INVALID_RESPONSE', false);
    }

    let output: ReturnType<typeof parseAdaptationOutput>;
    try {
      output = parseAdaptationOutput(JSON.parse(content) as unknown);
    } catch {
      throw new TranscriptAdaptationProviderError('INVALID_RESPONSE', false);
    }

    const usage = completion.usage;
    const hardwareCache = completion.x_groq?.usage;
    return {
      output,
      provider: this.providerName,
      model: completion.model || this.modelName,
      usage: {
        inputTokens: usage?.prompt_tokens ?? null,
        cachedInputTokens:
          usage?.prompt_tokens_details?.cached_tokens ??
          (hardwareCache
            ? (hardwareCache.dram_cached_tokens ?? 0) +
              (hardwareCache.sram_cached_tokens ?? 0)
            : null),
        outputTokens: usage?.completion_tokens ?? null,
      },
    };
  }
}
