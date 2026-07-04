import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionStatus } from '../entities/live-session.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import {
  buildSession,
  buildSessionRepo,
  buildTranscriptRepo,
} from '../testing/session-test.helpers';
import { AppendTranscriptSegmentUseCase } from './append-transcript-segment.usecase';

describe('AppendTranscriptSegmentUseCase', () => {
  let useCase: AppendTranscriptSegmentUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;
  let transcripts: ReturnType<typeof buildTranscriptRepo>;

  beforeEach(() => {
    sessions = buildSessionRepo();
    transcripts = buildTranscriptRepo();
    useCase = new AppendTranscriptSegmentUseCase(sessions, transcripts);
  });

  it('persists a trimmed segment for the owning teacher of a LIVE session', async () => {
    // Arrange
    sessions.findById.mockResolvedValue(buildSession());
    const segment = new TranscriptSegment({
      id: 't1',
      sessionId: 'session-1',
      seq: 1,
      text: 'Olá turma',
      createdAt: new Date(),
    });
    transcripts.append.mockResolvedValue(segment);

    // Act
    const result = await useCase.execute(
      'teacher-1',
      'session-1',
      '  Olá turma  ',
    );

    // Assert
    expect(transcripts.append).toHaveBeenCalledWith('session-1', 'Olá turma');
    expect(result).toBe(segment);
  });

  it('strips disfluencies before persisting', async () => {
    sessions.findById.mockResolvedValue(buildSession());
    const segment = new TranscriptSegment({
      id: 't1',
      sessionId: 'session-1',
      seq: 1,
      text: 'hoje vamos falar de frações',
      createdAt: new Date(),
    });
    transcripts.append.mockResolvedValue(segment);

    await useCase.execute(
      'teacher-1',
      'session-1',
      'hoje né vamos vamos falar de frações',
    );

    expect(transcripts.append).toHaveBeenCalledWith(
      'session-1',
      'hoje vamos falar de frações',
    );
  });

  it('returns null (and persists nothing) when the sentence was pure noise', async () => {
    sessions.findById.mockResolvedValue(buildSession());

    const result = await useCase.execute('teacher-1', 'session-1', 'né?');

    expect(result).toBeNull();
    expect(transcripts.append).not.toHaveBeenCalled();
  });

  it('rejects anyone who is not the owning teacher', async () => {
    sessions.findById.mockResolvedValue(buildSession());

    await expect(
      useCase.execute('student-1', 'session-1', 'texto'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transcripts.append).not.toHaveBeenCalled();
  });

  it('rejects writes after the session ended', async () => {
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.ENDED, endedAt: new Date() }),
    );

    await expect(
      useCase.execute('teacher-1', 'session-1', 'texto'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects empty or whitespace-only text', async () => {
    await expect(
      useCase.execute('teacher-1', 'session-1', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sessions.findById).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown session', async () => {
    sessions.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('teacher-1', 'ghost', 'texto'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
