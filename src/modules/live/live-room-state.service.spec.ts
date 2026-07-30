import { RoomParticipantRole } from '../rooms/entities/room.entity';
import { SessionStatus } from '../sessions/entities/live-session.entity';
import { LiveRoomStateService } from './live-room-state.service';

const participant = {
  participantId: 'participant-1',
  name: 'Ana',
  role: RoomParticipantRole.PARTICIPANT,
};

describe('LiveRoomStateService', () => {
  it('deduplicates multiple sockets from one participant', () => {
    const state = new LiveRoomStateService();
    expect(
      state.join('session-1', participant, 'socket-1', {
        status: SessionStatus.LIVE,
      }).firstJoin,
    ).toBe(true);
    expect(
      state.join('session-1', participant, 'socket-2', {
        status: SessionStatus.LIVE,
      }).firstJoin,
    ).toBe(false);
    expect(state.getParticipants('session-1')).toHaveLength(1);
    expect(state.removeSocket('socket-1')?.lastSocket).toBe(false);
    expect(state.removeSocket('socket-2')?.lastSocket).toBe(true);
  });

  it('tracks raised hands by generic participant identity', () => {
    const state = new LiveRoomStateService();
    state.join('session-1', participant, 'socket-1', {
      status: SessionStatus.LIVE,
    });
    expect(
      state.raiseHand('session-1', participant.participantId),
    ).toMatchObject({
      participantId: participant.participantId,
      name: participant.name,
    });
    expect(state.raiseHand('session-1', participant.participantId)).toBeNull();
    expect(state.lowerHand('session-1', participant.participantId)).toBe(true);
  });

  it('marks a live room read-only and clears it on close', () => {
    const state = new LiveRoomStateService();
    state.join('session-1', participant, 'socket-1', {
      status: SessionStatus.LIVE,
    });
    state.markEnded('session-1');
    expect(state.getMeta('session-1')?.status).toBe(SessionStatus.ENDED);
    expect(state.closeSession('session-1')).toEqual(['socket-1']);
    expect(state.getMeta('session-1')).toBeUndefined();
  });
});
