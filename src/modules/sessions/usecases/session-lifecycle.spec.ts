import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Room } from '../../rooms/entities/room.entity';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { CreateSessionUseCase } from './create-session.usecase';
import { EndSessionUseCase } from './end-session.usecase';
import { StartSessionUseCase } from './start-session.usecase';
import {
  buildRoomRepo,
  buildSession,
  buildSessionRepo,
  hostActor,
} from '../testing/session-test.helpers';
import { SessionStatus } from '../entities/live-session.entity';

describe('room session lifecycle', () => {
  const permissions = new RoomPermissionService();
  const room = new Room({
    id: 'room-1',
    name: 'Planejamento',
    hostId: hostActor.userId,
    inviteCode: 'ROOM1234',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it.each([RoomParticipantRole.HOST, RoomParticipantRole.MODERATOR])(
    'allows %s to create a PREPARING session',
    async (role) => {
      const sessions = buildSessionRepo();
      const rooms = buildRoomRepo();
      rooms.findById.mockResolvedValue(room);
      rooms.getParticipantRole.mockResolvedValue(role);
      const prepared = buildSession();
      sessions.create.mockResolvedValue(prepared);
      const result = await new CreateSessionUseCase(
        sessions,
        rooms,
        permissions,
      ).execute(hostActor, room.id, { title: ' Reunião semanal ' });
      expect(result.status).toBe(SessionStatus.PREPARING);
      expect(sessions.create).toHaveBeenCalledWith({
        title: 'Reunião semanal',
        roomId: room.id,
        joinToken: expect.any(String),
      });
    },
  );

  it('rejects session creation by a participant', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    rooms.findById.mockResolvedValue(room);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.PARTICIPANT);
    await expect(
      new CreateSessionUseCase(sessions, rooms, permissions).execute(
        hostActor,
        room.id,
        { title: 'Reunião' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('moves PREPARING to LIVE and records startedAt', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const prepared = buildSession();
    const live = buildSession({
      status: SessionStatus.LIVE,
      startedAt: new Date(),
    });
    sessions.findById.mockResolvedValue(prepared);
    sessions.start.mockResolvedValue(live);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);
    const result = await new StartSessionUseCase(
      sessions,
      rooms,
      permissions,
    ).execute(hostActor.userId, prepared.id);
    expect(result.status).toBe(SessionStatus.LIVE);
    expect(sessions.start).toHaveBeenCalledWith(prepared.id, expect.any(Date));
  });

  it('never restarts an ended session', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.ENDED, endedAt: new Date() }),
    );
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);
    await expect(
      new StartSessionUseCase(sessions, rooms, permissions).execute(
        hostActor.userId,
        'session-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ends a session idempotently', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const ended = buildSession({
      status: SessionStatus.ENDED,
      endedAt: new Date(),
    });
    sessions.findById.mockResolvedValue(ended);
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.MODERATOR);
    const result = await new EndSessionUseCase(
      sessions,
      rooms,
      permissions,
    ).execute('moderator-1', ended.id);
    expect(result).toBe(ended);
    expect(sessions.end).not.toHaveBeenCalled();
  });
});
