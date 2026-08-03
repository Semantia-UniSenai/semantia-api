import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { SessionStatus } from '../entities/live-session.entity';
import {
  buildRoomRepo,
  buildChatRepo,
  buildSession,
  buildSessionDetails,
  buildSessionRepo,
  buildTranscriptRepo,
} from '../testing/session-test.helpers';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';
import { GetSessionSnapshotUseCase } from './get-session-snapshot.usecase';
import { GetSessionUseCase } from './get-session.usecase';

describe('CheckSessionAccessUseCase', () => {
  const permissions = new RoomPermissionService();

  function setup(status = SessionStatus.LIVE) {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const session = buildSession({ status, startedAt: new Date() });
    sessions.findById.mockResolvedValue(session);
    return {
      sessions,
      rooms,
      session,
      useCase: new CheckSessionAccessUseCase(sessions, rooms, permissions),
    };
  }

  it.each([
    RoomParticipantRole.HOST,
    RoomParticipantRole.MODERATOR,
    RoomParticipantRole.PARTICIPANT,
  ])('grants an account its contextual %s role', async (role) => {
    const { rooms, useCase } = setup();
    rooms.getParticipantRole.mockResolvedValue(role);
    const access = await useCase.execute(
      { participantId: 'account-1', kind: 'account' },
      'session-1',
    );
    expect(access.role).toBe(role);
    expect(access.canManage).toBe(
      role === RoomParticipantRole.HOST ||
        role === RoomParticipantRole.MODERATOR,
    );
  });

  it('grants a signed guest identity only to its live session', async () => {
    const { useCase } = setup();
    const access = await useCase.execute(
      { participantId: 'guest:1', kind: 'guest', sessionId: 'session-1' },
      'session-1',
    );
    expect(access.role).toBe(RoomParticipantRole.GUEST);
  });

  it('accepts a live invite token without an account', async () => {
    const { session, useCase } = setup();
    const access = await useCase.execute(null, session.id, session.joinToken);
    expect(access.role).toBe(RoomParticipantRole.GUEST);
  });

  it('keeps an issued guest identity scoped to its ended session for read-only access', async () => {
    const { session, useCase } = setup(SessionStatus.ENDED);

    await expect(
      useCase.execute(
        {
          participantId: 'guest-1',
          kind: 'guest',
          sessionId: session.id,
        },
        session.id,
      ),
    ).resolves.toMatchObject({
      role: RoomParticipantRole.GUEST,
      canManage: false,
    });
  });

  it.each([SessionStatus.PREPARING, SessionStatus.ENDED])(
    'does not grant invitation access while %s',
    async (status) => {
      const { session, useCase } = setup(status);
      await expect(
        useCase.execute(null, session.id, session.joinToken),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('does not grant access to an unrelated account', async () => {
    const { rooms, useCase } = setup();
    rooms.getParticipantRole.mockResolvedValue(null);
    await expect(
      useCase.execute(
        { participantId: 'stranger', kind: 'account' },
        'session-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps participants out while managers prepare the session', async () => {
    const { rooms, useCase } = setup(SessionStatus.PREPARING);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.PARTICIPANT);
    await expect(
      useCase.execute(
        { participantId: 'participant-1', kind: 'account' },
        'session-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 for an unknown session', async () => {
    const { sessions, useCase } = setup();
    sessions.findById.mockResolvedValue(null);
    await expect(useCase.execute(null, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('does not disclose a reusable invite token to a participant', async () => {
    const sessions = buildSessionRepo();
    sessions.findDetailsById.mockResolvedValue({
      ...buildSessionDetails({ status: SessionStatus.LIVE }),
      joinToken: 'reusable-secret',
    });
    const access = {
      execute: jest.fn().mockResolvedValue({
        session: buildSession({ status: SessionStatus.LIVE }),
        role: RoomParticipantRole.PARTICIPANT,
        canManage: false,
      }),
    } as unknown as CheckSessionAccessUseCase;
    const useCase = new GetSessionUseCase(access, sessions);

    await expect(
      useCase.execute(
        { kind: 'account', participantId: 'participant-1' },
        'session-1',
      ),
    ).resolves.toMatchObject({ joinToken: '' });
  });

  it('does not disclose a reusable invite token in a participant snapshot', async () => {
    const sessions = buildSessionRepo();
    sessions.findDetailsById.mockResolvedValue(
      buildSessionDetails({
        status: SessionStatus.LIVE,
        joinToken: 'reusable-secret',
      }),
    );
    const access = {
      execute: jest.fn().mockResolvedValue({
        session: buildSession({ status: SessionStatus.LIVE }),
        role: RoomParticipantRole.PARTICIPANT,
        canManage: false,
      }),
    } as unknown as CheckSessionAccessUseCase;
    const useCase = new GetSessionSnapshotUseCase(
      access,
      sessions,
      buildChatRepo(),
      buildTranscriptRepo(),
    );

    await expect(
      useCase.execute(
        { kind: 'account', participantId: 'participant-1' },
        'session-1',
      ),
    ).resolves.toMatchObject({ session: { joinToken: '' } });
  });
});
