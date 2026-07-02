import { ForbiddenException } from '@nestjs/common';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import {
  buildSession,
  buildTranscriptRepo,
} from '../testing/session-test.helpers';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';
import { GetTranscriptUseCase } from './get-transcript.usecase';

describe('GetTranscriptUseCase', () => {
  let useCase: GetTranscriptUseCase;
  let transcripts: ReturnType<typeof buildTranscriptRepo>;
  let checkAccess: jest.Mocked<CheckSessionAccessUseCase>;

  beforeEach(() => {
    transcripts = buildTranscriptRepo();
    checkAccess = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CheckSessionAccessUseCase>;
    useCase = new GetTranscriptUseCase(transcripts, checkAccess);
  });

  it('returns the ordered transcript once access is granted', async () => {
    // Arrange
    checkAccess.execute.mockResolvedValue({
      session: buildSession(),
      isOwner: false,
    });
    const segments = [
      new TranscriptSegment({
        id: 't1',
        sessionId: 'session-1',
        seq: 1,
        text: 'Olá turma',
        createdAt: new Date(),
      }),
      new TranscriptSegment({
        id: 't2',
        sessionId: 'session-1',
        seq: 2,
        text: 'Hoje: laços de repetição',
        createdAt: new Date(),
      }),
    ];
    transcripts.findBySession.mockResolvedValue(segments);

    // Act
    const result = await useCase.execute('student-1', 'session-1', 'tok');

    // Assert
    expect(checkAccess.execute).toHaveBeenCalledWith(
      'student-1',
      'session-1',
      'tok',
    );
    expect(result).toBe(segments);
  });

  it('propagates access denial without reading segments', async () => {
    checkAccess.execute.mockRejectedValue(new ForbiddenException());

    await expect(
      useCase.execute('stranger', 'session-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transcripts.findBySession).not.toHaveBeenCalled();
  });
});
