import { loadTranscriptAdaptationConfig } from '../config/transcript-adaptation.config';
import { buildTranscriptAdaptationTestInput } from '../testing/transcript-adaptation-test.helpers';
import { GroqTranscriptAdaptationProvider } from './groq-transcript-adaptation.provider';

const completion = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          adaptedText: 'A reunião começa às 14h30.',
          decision: 'adapted',
          risk: 'none',
        }),
      },
    },
  ],
  model: 'openai/gpt-oss-20b',
  usage: {
    prompt_tokens: 80,
    completion_tokens: 12,
    total_tokens: 92,
    prompt_tokens_details: { cached_tokens: 20 },
  },
};

const buildProvider = (create: jest.Mock) => {
  const config = loadTranscriptAdaptationConfig({
    TRANSCRIPT_ADAPTATION_ENABLED: 'true',
    TRANSCRIPT_ADAPTATION_PROVIDER: 'groq',
    GROQ_API_KEY: 'synthetic-test-secret',
  });
  return new GroqTranscriptAdaptationProvider({ create }, config);
};

describe('GroqTranscriptAdaptationProvider', () => {
  it('envia request estrita e retorna somente saída validada e uso', async () => {
    const create = jest.fn().mockResolvedValue(completion);
    const provider = buildProvider(create);
    const input = buildTranscriptAdaptationTestInput();
    const controller = new AbortController();

    const result = await provider.adapt(input, controller.signal);

    expect(create).toHaveBeenCalledTimes(1);
    const [request, options] = create.mock.calls[0] as [
      Record<string, unknown>,
      { signal: AbortSignal },
    ];
    expect(request).toMatchObject({
      model: 'openai/gpt-oss-20b',
      stream: false,
      n: 1,
      temperature: 0.1,
      max_completion_tokens: 512,
      include_reasoning: false,
      reasoning_effort: 'low',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'transcript_adaptation',
          strict: true,
          schema: expect.objectContaining({
            type: 'object',
            additionalProperties: false,
          }),
        },
      },
      messages: [
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('DADOS_NAO_CONFIAVEIS'),
        }),
      ],
    });
    expect(request).not.toHaveProperty('tools');
    expect(request).not.toHaveProperty('reasoning_format');
    expect(JSON.stringify(request.messages)).toContain('Familiaridade média');
    expect(JSON.stringify(request.messages)).toContain('pt-br-accessible-v2');
    expect(options.signal).toBe(controller.signal);
    expect(result).toEqual({
      output: {
        adaptedText: 'A reunião começa às 14h30.',
        decision: 'adapted',
        risk: 'none',
      },
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      usage: {
        inputTokens: 80,
        cachedInputTokens: 20,
        outputTokens: 12,
      },
    });
  });

  it.each([
    ['JSON inválido', '{'],
    [
      'schema inválido',
      JSON.stringify({
        adaptedText: '',
        decision: 'adapted',
        risk: 'none',
        extra: true,
      }),
    ],
  ])('rejeita %s localmente sem retry', async (_label, content) => {
    const create = jest.fn().mockResolvedValue({
      ...completion,
      choices: [{ message: { content } }],
    });

    await expect(
      buildProvider(create).adapt(
        buildTranscriptAdaptationTestInput(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    });
  });
});
