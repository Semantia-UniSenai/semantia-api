import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionStatus } from '../entities/live-session.entity';
import {
  buildSession,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { EndSessionUseCase } from './end-session.usecase';

describe('EndSessionUseCase', () => {
  let useCase: EndSessionUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;

  beforeEach(() => {
    sessions = buildSessionRepo();
    useCase = new EndSessionUseCase(sessions);
  });

  it('marks a LIVE session as ENDED with endedAt', async () => {
    // Arrange
    sessions.findById.mockResolvedValue(buildSession());
    const ended = buildSession({
      status: SessionStatus.ENDED,
      endedAt: new Date(),
    });
    sessions.end.mockResolvedValue(ended);

    // Act
    const result = await useCase.execute('teacher-1', 'session-1');

    // Assert
    expect(sessions.end).toHaveBeenCalledWith('session-1', expect.any(Date));
    expect(result).toBe(ended);
  });

  it('is idempotent: an already-ended session is returned untouched', async () => {
    // Arrange
    const ended = buildSession({
      status: SessionStatus.ENDED,
      endedAt: new Date(),
    });
    sessions.findById.mockResolvedValue(ended);

    // Act
    const result = await useCase.execute('teacher-1', 'session-1');

    // Assert
    expect(sessions.end).not.toHaveBeenCalled();
    expect(result).toBe(ended);
  });

  it('rejects a user who is not the owning teacher', async () => {
    sessions.findById.mockResolvedValue(buildSession());

    await expect(
      useCase.execute('student-1', 'session-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.end).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown session', async () => {
    sessions.findById.mockResolvedValue(null);

    await expect(useCase.execute('teacher-1', 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
