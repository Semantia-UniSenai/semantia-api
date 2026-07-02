import { NotFoundException } from '@nestjs/common';
import { SessionStatus } from '../entities/live-session.entity';
import {
  buildSession,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { ResolveJoinTokenUseCase } from './resolve-join-token.usecase';

describe('ResolveJoinTokenUseCase', () => {
  let useCase: ResolveJoinTokenUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;

  beforeEach(() => {
    sessions = buildSessionRepo();
    useCase = new ResolveJoinTokenUseCase(sessions);
  });

  it('resolves a valid token to the minimal session pointer', async () => {
    // Arrange
    sessions.findByJoinToken.mockResolvedValue(buildSession());

    // Act / Assert — no joinToken leakage in the response
    await expect(useCase.execute('tok_abc123')).resolves.toEqual({
      sessionId: 'session-1',
      title: 'Aula 1',
      status: SessionStatus.LIVE,
    });
    expect(sessions.findByJoinToken).toHaveBeenCalledWith('tok_abc123');
  });

  it('throws 404 for an unknown token', async () => {
    sessions.findByJoinToken.mockResolvedValue(null);

    await expect(useCase.execute('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
