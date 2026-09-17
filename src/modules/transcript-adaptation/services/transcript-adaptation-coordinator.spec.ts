import {
  RoomSession,
  SessionStatus,
} from '../../sessions/entities/live-session.entity';
import { TranscriptSegment } from '../../sessions/entities/transcript-segment.entity';
import { RoomSessionRepository } from '../../sessions/repositories/live-session.repository';
import { TranscriptAdaptationFailureCode } from '../entities/transcript-adaptation.entity';
import { TranscriptAdaptationQueue } from './transcript-adaptation-queue';
import { TranscriptAdaptationCoordinator } from './transcript-adaptation-coordinator';
import { AdaptTranscriptSegmentUseCase } from '../usecases/adapt-transcript-segment.usecase';

const context = {
  meetingType: 'empresa' as const,
  ageRange: 'adultos' as const,
  portugueseFamiliarity: 'media' as const,
  domain: 'Planejamento',
  simplificationLevel: 'moderada' as const,
};

const session = new RoomSession({
  id: 'session-1',
  title: 'Reunião',
  roomId: 'room-1',
  joinToken: 'not-used-by-adaptation',
  status: SessionStatus.LIVE,
  requiresApproval: false,
  audienceContext: context,
  audienceContextVersion: 3,
  createdAt: new Date('2026-08-10T12:00:00Z'),
  startedAt: new Date('2026-08-10T12:00:00Z'),
  endedAt: null,
});

const segment = new TranscriptSegment({
  id: 'segment-1',
  sessionId: session.id,
  clientSegmentId: 'client-1',
  seq: 4,
  text: 'A pauta será apresentada.',
  cleaningStrategyVersion: 'pt-br-conservative-v1',
  createdAt: new Date('2026-08-10T12:00:01Z'),
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const build = (maxConcurrency = 1, maxQueue = 2) => {
  const sessions = {
    findById: jest.fn().mockResolvedValue(session),
  } as unknown as jest.Mocked<RoomSessionRepository>;
  const useCase = {
    execute: jest.fn(),
    fallback: jest.fn(),
    bypass: jest.fn(),
  } as unknown as jest.Mocked<AdaptTranscriptSegmentUseCase>;
  const queue = new TranscriptAdaptationQueue({ maxConcurrency, maxQueue });
  return {
    sessions,
    useCase,
    coordinator: new TranscriptAdaptationCoordinator(useCase, queue),
  };
};

describe('TranscriptAdaptationCoordinator', () => {
  it('usa o snapshot capturado com o segmento sem reler contexto depois', async () => {
    const { coordinator, sessions, useCase } = build();
    const result = { event: { segmentId: segment.id } };
    useCase.execute.mockResolvedValue(result as never);

    await expect(
      coordinator.enqueue(segment, { context, contextVersion: 3 }),
    ).resolves.toBe(result);

    expect(sessions.findById).not.toHaveBeenCalled();
    expect(useCase.execute).toHaveBeenCalledWith({
      segment,
      context,
      contextVersion: 3,
    });
  });

  it('materializa bypass sem provider quando a entrada ASR é suspeita', async () => {
    const { coordinator, useCase } = build();
    const bypass = { event: { segmentId: segment.id } };
    useCase.bypass.mockResolvedValue(bypass as never);

    await expect(
      coordinator.enqueue(
        segment,
        { context, contextVersion: 3 },
        'SUSPECT_DENSITY',
      ),
    ).resolves.toBe(bypass);

    expect(useCase.execute).not.toHaveBeenCalled();
    expect(useCase.bypass).toHaveBeenCalledWith(
      { segment, context, contextVersion: 3 },
      TranscriptAdaptationFailureCode.SUSPECT_INPUT,
    );
  });

  it('compartilha a mesma Promise para o mesmo segmento concorrente', async () => {
    const { coordinator, useCase } = build();
    const controlled = deferred<never>();
    useCase.execute.mockReturnValue(controlled.promise);

    const snapshot = { context, contextVersion: 3 };
    const first = coordinator.enqueue(segment, snapshot);
    const duplicate = coordinator.enqueue(segment, snapshot);

    expect(duplicate).toBe(first);
    await Promise.resolve();
    expect(useCase.execute).toHaveBeenCalledTimes(1);
  });

  it('materializa fallback auditável quando a fila está cheia', async () => {
    const { coordinator, useCase } = build(1, 0);
    const running = deferred<never>();
    useCase.execute.mockReturnValue(running.promise);
    const otherSegment = new TranscriptSegment({
      ...segment,
      id: 'segment-2',
      seq: 5,
    });
    const fallbackResult = { event: { segmentId: otherSegment.id } };
    useCase.fallback.mockResolvedValue(fallbackResult as never);

    const snapshot = { context, contextVersion: 3 };
    void coordinator.enqueue(segment, snapshot);
    await expect(coordinator.enqueue(otherSegment, snapshot)).resolves.toBe(
      fallbackResult,
    );

    expect(useCase.fallback).toHaveBeenCalledWith(
      {
        segment: otherSegment,
        context,
        contextVersion: 3,
      },
      TranscriptAdaptationFailureCode.QUEUE_FULL,
    );
  });
});
