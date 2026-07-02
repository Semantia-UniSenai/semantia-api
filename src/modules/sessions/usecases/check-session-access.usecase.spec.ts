import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionStatus } from '../entities/live-session.entity';
import {
  buildClassRepo,
  buildSession,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';

describe('CheckSessionAccessUseCase', () => {
  let useCase: CheckSessionAccessUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;
  let classes: ReturnType<typeof buildClassRepo>;

  beforeEach(() => {
    sessions = buildSessionRepo();
    classes = buildClassRepo();
    useCase = new CheckSessionAccessUseCase(sessions, classes);
  });

  it('grants the owning teacher access (isOwner true)', async () => {
    const session = buildSession();
    sessions.findById.mockResolvedValue(session);

    const result = await useCase.execute('teacher-1', 'session-1');

    expect(result).toEqual({ session, isOwner: true });
    expect(classes.isMember).not.toHaveBeenCalled();
  });

  it('grants any authenticated user with a valid joinToken', async () => {
    sessions.findById.mockResolvedValue(buildSession());

    const result = await useCase.execute(
      'stranger-1',
      'session-1',
      'tok_abc123',
    );

    expect(result.isOwner).toBe(false);
    expect(classes.isMember).not.toHaveBeenCalled();
  });

  it('rejects an invalid joinToken for a classless session', async () => {
    sessions.findById.mockResolvedValue(buildSession());

    await expect(
      useCase.execute('stranger-1', 'session-1', 'wrong-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants a member of the session class (no token needed)', async () => {
    sessions.findById.mockResolvedValue(buildSession({ classId: 'class-1' }));
    classes.isMember.mockResolvedValue(true);

    const result = await useCase.execute('student-1', 'session-1');

    expect(result.isOwner).toBe(false);
    expect(classes.isMember).toHaveBeenCalledWith('class-1', 'student-1');
  });

  it('rejects a non-member without token', async () => {
    sessions.findById.mockResolvedValue(buildSession({ classId: 'class-1' }));
    classes.isMember.mockResolvedValue(false);

    await expect(
      useCase.execute('stranger-1', 'session-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still grants access to an ENDED session (read-only replay)', async () => {
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.ENDED, endedAt: new Date() }),
    );

    const result = await useCase.execute(
      'stranger-1',
      'session-1',
      'tok_abc123',
    );

    expect(result.session.status).toBe(SessionStatus.ENDED);
  });

  it('throws 404 for an unknown session', async () => {
    sessions.findById.mockResolvedValue(null);

    await expect(useCase.execute('teacher-1', 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
