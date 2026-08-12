import { PrismaService } from '../../../database/prisma.service';
import {
  TranscriptAdaptationFailureCode,
  TranscriptAdaptationStatus,
} from '../entities/transcript-adaptation.entity';
import { PrismaTranscriptAdaptationRepository } from './prisma-transcript-adaptation.repository';

const contextSnapshot = {
  meetingType: 'empresa' as const,
  ageRange: 'adultos' as const,
  portugueseFamiliarity: 'media' as const,
  domain: 'Segurança operacional',
  simplificationLevel: 'moderada' as const,
};

const pendingRow = {
  id: 'adaptation-1',
  transcriptSegmentId: 'segment-1',
  text: null,
  status: TranscriptAdaptationStatus.PENDING,
  failureCode: null,
  contextVersion: 2,
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
};

describe('PrismaTranscriptAdaptationRepository', () => {
  it('cria o pending de forma idempotente por segmento', async () => {
    const upsert = jest.fn().mockResolvedValue(pendingRow);
    const prisma = {
      transcriptAdaptation: { upsert },
    } as unknown as PrismaService;
    const repository = new PrismaTranscriptAdaptationRepository(prisma);

    const result = await repository.createPending({
      transcriptSegmentId: 'segment-1',
      contextVersion: 2,
      contextSnapshot,
      promptVersion: 'pt-br-accessible-v1',
      provider: 'fake',
      model: 'fake-deterministic-v1',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { transcriptSegmentId: 'segment-1' },
      create: {
        transcriptSegmentId: 'segment-1',
        contextVersion: 2,
        contextSnapshot,
        promptVersion: 'pt-br-accessible-v1',
        provider: 'fake',
        model: 'fake-deterministic-v1',
      },
      update: {},
    });
    expect(result.status).toBe(TranscriptAdaptationStatus.PENDING);
  });

  it('finaliza sucesso somente a partir de pending', async () => {
    const succeededRow = {
      ...pendingRow,
      text: 'Saia pela porta da direita.',
      status: TranscriptAdaptationStatus.SUCCEEDED,
      latencyMs: 210,
      inputTokens: 80,
      outputTokens: 12,
      attemptCount: 1,
      completedAt: new Date('2026-08-10T12:00:01Z'),
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = jest.fn().mockResolvedValue(succeededRow);
    const prisma = {
      transcriptAdaptation: { updateMany, findUniqueOrThrow },
    } as unknown as PrismaService;
    const repository = new PrismaTranscriptAdaptationRepository(prisma);

    const result = await repository.completeSuccess('segment-1', {
      text: 'Saia pela porta da direita.',
      latencyMs: 210,
      inputTokens: 80,
      outputTokens: 12,
      attemptCount: 1,
      completedAt: new Date('2026-08-10T12:00:01Z'),
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        transcriptSegmentId: 'segment-1',
        status: TranscriptAdaptationStatus.PENDING,
      },
      data: expect.objectContaining({
        status: TranscriptAdaptationStatus.SUCCEEDED,
        text: 'Saia pela porta da direita.',
        failureCode: null,
      }),
    });
    expect(result.status).toBe(TranscriptAdaptationStatus.SUCCEEDED);
  });

  it('marca pendências interrompidas sem reinferir', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      transcriptAdaptation: { updateMany },
    } as unknown as PrismaService;
    const repository = new PrismaTranscriptAdaptationRepository(prisma);
    const staleBefore = new Date('2026-08-10T12:00:00Z');

    const count = await repository.markStalePendingAsFallback(staleBefore);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: TranscriptAdaptationStatus.PENDING,
        createdAt: { lt: staleBefore },
      },
      data: expect.objectContaining({
        status: TranscriptAdaptationStatus.FALLBACK,
        failureCode: TranscriptAdaptationFailureCode.PROCESS_INTERRUPTED,
        completedAt: expect.any(Date),
      }),
    });
    expect(count).toBe(3);
  });
});
