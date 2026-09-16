import { PrismaService } from '../../../database/prisma.service';
import { PrismaTranscriptRepository } from './prisma-transcript.repository';

const baseRow = {
  id: 'segment-1',
  sessionId: 'session-1',
  clientSegmentId: 'client-1',
  seq: 1,
  text: 'O prazo é 42 dias.',
  cleaningStrategyVersion: 'pt-br-conservative-v1',
  createdAt: new Date('2026-08-10T12:00:00Z'),
};

const adaptation = {
  id: 'adaptation-1',
  transcriptSegmentId: 'segment-1',
  text: 'O prazo total é 42 dias.',
  status: 'SUCCEEDED',
  failureCode: null,
  contextVersion: 2,
  contextSnapshot: {},
  promptVersion: 'pt-br-accessible-v1',
  provider: 'fake',
  model: 'fake-deterministic-v1',
  latencyMs: 12,
  inputTokens: 10,
  cachedInputTokens: 0,
  outputTokens: 8,
  attemptCount: 1,
  createdAt: new Date('2026-08-10T12:00:00Z'),
  updatedAt: new Date('2026-08-10T12:00:01Z'),
  completedAt: new Date('2026-08-10T12:00:01Z'),
};

const build = (rows: unknown[]) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = {
    transcriptSegment: { findMany },
  } as unknown as PrismaService;
  return { repository: new PrismaTranscriptRepository(prisma), findMany };
};

describe('PrismaTranscriptRepository adaptation projection', () => {
  it('inclui adaptação terminal no replay ordenado', async () => {
    const { repository, findMany } = build([{ ...baseRow, adaptation }]);

    const [segment] = await repository.findBySession('session-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { adaptation: true } }),
    );
    expect(segment.adaptation).toEqual({
      text: 'O prazo total é 42 dias.',
      status: 'succeeded',
      failureCode: null,
      automatic: true,
      contextVersion: 2,
      promptVersion: 'pt-br-accessible-v1',
      provider: 'fake',
      model: 'fake-deterministic-v1',
      at: new Date('2026-08-10T12:00:01Z'),
    });
  });

  it('materializa o literal no fallback sem persistir cópia', async () => {
    const { repository } = build([
      {
        ...baseRow,
        adaptation: {
          ...adaptation,
          text: null,
          status: 'FALLBACK',
          failureCode: 'TIMEOUT',
        },
      },
    ]);

    const [segment] = await repository.findBySession('session-1');

    expect(segment.adaptation).toMatchObject({
      text: baseRow.text,
      status: 'fallback',
      failureCode: 'TIMEOUT',
    });
  });

  it('não expõe pending como adaptação terminal', async () => {
    const { repository } = build([
      {
        ...baseRow,
        adaptation: { ...adaptation, text: null, status: 'PENDING' },
      },
    ]);

    const [segment] = await repository.findBySession('session-1');

    expect(segment.adaptation).toBeNull();
  });
});
