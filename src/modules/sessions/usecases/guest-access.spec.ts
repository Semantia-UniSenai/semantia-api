import { JwtService } from '@nestjs/jwt';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { SessionStatus } from '../entities/live-session.entity';
import {
  buildSession,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { CreateGuestAccessUseCase } from './create-guest-access.usecase';

describe('CreateGuestAccessUseCase', () => {
  it('issues a four-hour token restricted to one LIVE session', async () => {
    const sessions = buildSessionRepo();
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('guest.jwt'),
    } as unknown as JwtService;
    sessions.findByJoinToken.mockResolvedValue(
      buildSession({ status: SessionStatus.LIVE, startedAt: new Date() }),
    );
    const result = await new CreateGuestAccessUseCase(sessions, jwt).execute(
      'tok_abc1234567890',
      ' Bruno ',
    );
    expect(result.accessToken).toBe('guest.jwt');
    expect(result.participant).toEqual({
      participantId: expect.stringMatching(/^guest:/),
      name: 'Bruno',
      role: RoomParticipantRole.GUEST,
    });
    expect((jwt.signAsync as jest.Mock).mock.calls[0][0]).toMatchObject({
      kind: 'guest',
      sessionId: 'session-1',
      name: 'Bruno',
    });
    expect((jwt.signAsync as jest.Mock).mock.calls[0][1]).toEqual({
      expiresIn: '4h',
    });
  });
});
