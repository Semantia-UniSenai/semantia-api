import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { EndSessionUseCase } from './end-session.usecase';
import {
  buildRoomRepo,
  buildSession,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { SessionStatus } from '../entities/live-session.entity';

describe('instant meeting lifecycle', () => {
  const permissions = new RoomPermissionService();

  it('ends a meeting idempotently', async () => {
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
