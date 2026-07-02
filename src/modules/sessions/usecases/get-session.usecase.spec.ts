import { ForbiddenException } from '@nestjs/common';
import {
  buildSession,
  buildSessionDetails,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';
import { GetSessionUseCase } from './get-session.usecase';

describe('GetSessionUseCase', () => {
  let useCase: GetSessionUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;
  let checkAccess: jest.Mocked<CheckSessionAccessUseCase>;

  beforeEach(() => {
    sessions = buildSessionRepo();
    checkAccess = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CheckSessionAccessUseCase>;
    useCase = new GetSessionUseCase(sessions, checkAccess);
  });

  it('returns enriched details after the shared access check passes', async () => {
    // Arrange
    checkAccess.execute.mockResolvedValue({
      session: buildSession(),
      isOwner: false,
    });
    const details = buildSessionDetails();
    sessions.findDetailsById.mockResolvedValue(details);

    // Act
    const result = await useCase.execute('student-1', 'session-1', 'tok');

    // Assert — the token is forwarded to the single access rule
    expect(checkAccess.execute).toHaveBeenCalledWith(
      'student-1',
      'session-1',
      'tok',
    );
    expect(result).toBe(details);
  });

  it('propagates access denial without touching the repository', async () => {
    // Arrange
    checkAccess.execute.mockRejectedValue(new ForbiddenException());

    // Act / Assert
    await expect(
      useCase.execute('stranger', 'session-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessions.findDetailsById).not.toHaveBeenCalled();
  });
});
