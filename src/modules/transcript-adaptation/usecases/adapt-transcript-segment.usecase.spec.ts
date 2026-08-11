import { TranscriptSegment } from '../../sessions/entities/transcript-segment.entity';
import { loadTranscriptAdaptationConfig } from '../config/transcript-adaptation.config';
import {
  TranscriptAdaptation,
  TranscriptAdaptationFailureCode,
  TranscriptAdaptationStatus,
} from '../entities/transcript-adaptation.entity';
import { FakeTranscriptAdaptationProvider } from '../providers/fake-transcript-adaptation.provider';
import { AdaptationCircuitBreaker } from '../resilience/circuit-breaker';
import { TranscriptAdaptationRepository } from '../repositories/transcript-adaptation.repository';
import { AdaptTranscriptSegmentUseCase } from './adapt-transcript-segment.usecase';

const segment = new TranscriptSegment({
  id: 'segment-1',
  sessionId: 'session-1',
  clientSegmentId: 'client-1',
  seq: 7,
  text: 'A reunião ocorrerá amanhã.',
  cleaningStrategyVersion: 'pt-br-conservative-v1',
  createdAt: new Date('2026-08-10T12:00:00Z'),
});

const context = {
  meetingType: 'empresa' as const,
  ageRange: 'adultos' as const,
  portugueseFamiliarity: 'media' as const,
  domain: 'Planejamento',
  simplificationLevel: 'moderada' as const,
};

const pending = (contextSnapshot: typeof context | null = context) =>
  new TranscriptAdaptation({
    id: 'adaptation-1',
    transcriptSegmentId: segment.id,
    text: null,
    status: TranscriptAdaptationStatus.PENDING,
    failureCode: null,
    contextVersion: contextSnapshot ? 2 : 0,
    contextSnapshot,
    promptVersion: 'pt-br-accessible-v1',
    provider: 'fake',
    model: 'fake-deterministic-v1',
    latencyMs: null,
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    attemptCount: 0,
    createdAt: new Date('2026-08-10T12:00:00Z'),
    updatedAt: new Date('2026-08-10T12:00:00Z'),
    completedAt: null,
  });

const buildRepository = () => {
  const repository: jest.Mocked<TranscriptAdaptationRepository> = {
    createPending: jest.fn(),
    findBySegmentId: jest.fn().mockResolvedValue(null),
    completeSuccess: jest.fn(),
    completeFailure: jest.fn(),
    markStalePendingAsFallback: jest.fn(),
  };
  repository.createPending.mockResolvedValue(pending());
  repository.completeSuccess.mockImplementation((_, data) =>
    Promise.resolve(
      new TranscriptAdaptation({
        ...pending(),
        ...data,
        status: TranscriptAdaptationStatus.SUCCEEDED,
        failureCode: null,
        updatedAt: data.completedAt,
      }),
    ),
  );
  repository.completeFailure.mockImplementation((_, data) =>
    Promise.resolve(
      new TranscriptAdaptation({
        ...pending(),
        ...data,
        text: null,
        updatedAt: data.completedAt,
      }),
    ),
  );
  return repository;
};

const buildUseCase = (
  provider: FakeTranscriptAdaptationProvider,
  repository = buildRepository(),
  enabled = true,
) => {
  const config = loadTranscriptAdaptationConfig({
    TRANSCRIPT_ADAPTATION_ENABLED: String(enabled),
    TRANSCRIPT_ADAPTATION_PROVIDER: enabled ? 'fake' : 'disabled',
    TRANSCRIPT_ADAPTATION_MAX_RETRIES: '0',
  });
  return {
    repository,
    useCase: new AdaptTranscriptSegmentUseCase(
      repository,
      provider,
      config,
      new AdaptationCircuitBreaker({ failureThreshold: 2, resetMs: 1_000 }),
    ),
  };
};

describe('AdaptTranscriptSegmentUseCase', () => {
  it('sem contexto persiste bypass explícito e não chama provider', async () => {
    const provider = new FakeTranscriptAdaptationProvider({ mode: 'success' });
    const { useCase, repository } = buildUseCase(provider);
    repository.createPending.mockResolvedValue(pending(null));
    repository.completeFailure.mockImplementation((_, data) =>
      Promise.resolve(
        new TranscriptAdaptation({
          ...pending(null),
          ...data,
          text: null,
          updatedAt: data.completedAt,
        }),
      ),
    );

    const result = await useCase.execute({
      segment,
      context: null,
      contextVersion: 0,
    });

    expect(provider.callCount).toBe(0);
    expect(repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ contextSnapshot: null, contextVersion: 0 }),
    );
    expect(repository.completeFailure).toHaveBeenCalledWith(
      segment.id,
      expect.objectContaining({
        status: TranscriptAdaptationStatus.BYPASSED,
        failureCode: TranscriptAdaptationFailureCode.NO_CONTEXT,
        attemptCount: 0,
      }),
    );
    expect(result.event).toMatchObject({
      segmentId: segment.id,
      sessionId: segment.sessionId,
      seq: segment.seq,
      adaptation: { text: segment.text, status: 'bypassed' },
    });
  });

  it('conteúdo urgente faz bypass conservador', async () => {
    const provider = new FakeTranscriptAdaptationProvider({ mode: 'success' });
    const { useCase, repository } = buildUseCase(provider);
    const urgent = new TranscriptSegment({
      ...segment,
      text: 'Fogo! Evacue a sala agora.',
    });

    const result = await useCase.execute({
      segment: urgent,
      context,
      contextVersion: 2,
    });

    expect(provider.callCount).toBe(0);
    expect(repository.completeFailure).toHaveBeenCalledWith(
      urgent.id,
      expect.objectContaining({
        status: TranscriptAdaptationStatus.BYPASSED,
        failureCode: TranscriptAdaptationFailureCode.HIGH_RISK,
      }),
    );
    expect(result.event.adaptation.text).toBe(urgent.text);
  });

  it('configuração disabled faz bypass antes do provider', async () => {
    const provider = new FakeTranscriptAdaptationProvider({ mode: 'success' });
    const { useCase, repository } = buildUseCase(
      provider,
      buildRepository(),
      false,
    );

    const result = await useCase.execute({
      segment,
      context,
      contextVersion: 2,
    });

    expect(provider.callCount).toBe(0);
    expect(repository.completeFailure).toHaveBeenCalledWith(
      segment.id,
      expect.objectContaining({
        status: TranscriptAdaptationStatus.BYPASSED,
        failureCode: TranscriptAdaptationFailureCode.DISABLED,
        attemptCount: 0,
      }),
    );
    expect(result.event.adaptation.text).toBe(segment.text);
  });

  it('risco urgente declarado na saída conserva o literal', async () => {
    const provider = new FakeTranscriptAdaptationProvider({
      mode: 'success',
      output: {
        adaptedText: 'Faça isso agora.',
        decision: 'adapted',
        risk: 'urgent',
      },
    });
    const { useCase, repository } = buildUseCase(provider);

    const result = await useCase.execute({
      segment,
      context,
      contextVersion: 2,
    });

    expect(repository.completeSuccess).not.toHaveBeenCalled();
    expect(repository.completeFailure).toHaveBeenCalledWith(
      segment.id,
      expect.objectContaining({
        status: TranscriptAdaptationStatus.BYPASSED,
        failureCode: TranscriptAdaptationFailureCode.HIGH_RISK,
      }),
    );
    expect(result.event.adaptation.text).toBe(segment.text);
  });

  it('sucesso validado persiste adaptação e input mínimo', async () => {
    const provider = new FakeTranscriptAdaptationProvider({
      mode: 'success',
      output: {
        adaptedText: 'A reunião será amanhã.',
        decision: 'adapted',
        risk: 'none',
      },
    });
    const { useCase, repository } = buildUseCase(provider);

    const result = await useCase.execute({
      segment,
      context,
      contextVersion: 2,
    });

    expect(provider.inputs).toEqual([
      {
        literalText: segment.text,
        language: 'pt-BR',
        contextVersion: 2,
        context,
        promptVersion: 'pt-br-accessible-v1',
      },
    ]);
    expect(repository.completeSuccess).toHaveBeenCalledWith(
      segment.id,
      expect.objectContaining({
        text: 'A reunião será amanhã.',
        attemptCount: 1,
        inputTokens: 0,
        outputTokens: 0,
      }),
    );
    expect(result.event.adaptation).toMatchObject({
      text: 'A reunião será amanhã.',
      status: 'succeeded',
      automatic: true,
      contextVersion: 2,
      promptVersion: 'pt-br-accessible-v1',
    });
  });

  it('violação semântica materializa literal sem persistir cópia', async () => {
    const protectedSegment = new TranscriptSegment({
      ...segment,
      text: 'O prazo é 42 dias.',
    });
    const provider = new FakeTranscriptAdaptationProvider({
      mode: 'success',
      output: {
        adaptedText: 'O prazo é 43 dias.',
        decision: 'adapted',
        risk: 'none',
      },
    });
    const { useCase, repository } = buildUseCase(provider);

    const result = await useCase.execute({
      segment: protectedSegment,
      context,
      contextVersion: 2,
    });

    expect(repository.completeSuccess).not.toHaveBeenCalled();
    expect(repository.completeFailure).toHaveBeenCalledWith(
      protectedSegment.id,
      expect.objectContaining({
        failureCode: TranscriptAdaptationFailureCode.PRESERVATION_FAILED,
      }),
    );
    expect(result.adaptation.text).toBeNull();
    expect(result.event.adaptation.text).toBe(protectedSegment.text);
  });

  it('erro do provider mantém literal e código auditável', async () => {
    const provider = new FakeTranscriptAdaptationProvider({ mode: 'error' });
    const { useCase, repository } = buildUseCase(provider);

    const result = await useCase.execute({
      segment,
      context,
      contextVersion: 2,
    });

    expect(repository.completeFailure).toHaveBeenCalledWith(
      segment.id,
      expect.objectContaining({
        status: TranscriptAdaptationStatus.FALLBACK,
        failureCode: TranscriptAdaptationFailureCode.PROVIDER_ERROR,
        attemptCount: 1,
      }),
    );
    expect(result.event.adaptation.text).toBe(segment.text);
  });

  it('estado terminal persistido impede nova inferência', async () => {
    const provider = new FakeTranscriptAdaptationProvider({ mode: 'success' });
    const repository = buildRepository();
    repository.findBySegmentId.mockResolvedValue(
      new TranscriptAdaptation({
        ...pending(),
        text: 'A reunião será amanhã.',
        status: TranscriptAdaptationStatus.SUCCEEDED,
        completedAt: new Date('2026-08-10T12:00:01Z'),
      }),
    );
    const { useCase } = buildUseCase(provider, repository);

    const result = await useCase.execute({
      segment,
      context,
      contextVersion: 2,
    });

    expect(provider.callCount).toBe(0);
    expect(repository.createPending).not.toHaveBeenCalled();
    expect(result.event.adaptation.text).toBe('A reunião será amanhã.');
  });
});
