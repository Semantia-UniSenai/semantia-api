import { UserRole } from '../../shared/enums/user-role.enum';
import { SessionStatus } from '../sessions/entities/live-session.entity';
import {
  LiveParticipant,
  LiveRoomStateService,
  SessionMeta,
} from './live-room-state.service';

describe('LiveRoomStateService', () => {
  let service: LiveRoomStateService;

  const teacher: LiveParticipant = {
    userId: 'teacher-1',
    name: 'Carlos Lima',
    role: UserRole.PROFESSOR,
  };
  const student: LiveParticipant = {
    userId: 'student-1',
    name: 'Ana',
    role: UserRole.ALUNO,
  };
  const meta: SessionMeta = {
    teacherId: 'teacher-1',
    status: SessionStatus.LIVE,
  };

  beforeEach(() => {
    service = new LiveRoomStateService();
  });

  describe('join', () => {
    it('reports firstJoin true for the first socket of a user', () => {
      const result = service.join('session-1', student, 'sock-1', meta);

      expect(result).toEqual({ firstJoin: true });
    });

    it('reports firstJoin false for a second socket of the same user', () => {
      service.join('session-1', student, 'sock-1', meta);

      const result = service.join('session-1', student, 'sock-2', meta);

      expect(result).toEqual({ firstJoin: false });
      expect(service.getParticipants('session-1')).toHaveLength(1);
    });
  });

  describe('getParticipants', () => {
    it('lists each user once regardless of socket count', () => {
      service.join('session-1', teacher, 'sock-1', meta);
      service.join('session-1', student, 'sock-2', meta);
      service.join('session-1', student, 'sock-3', meta);

      expect(service.getParticipants('session-1')).toEqual([teacher, student]);
    });

    it('returns an empty list for an unknown session', () => {
      expect(service.getParticipants('ghost')).toEqual([]);
    });
  });

  describe('raiseHand', () => {
    it('preserves the order in which hands went up', () => {
      service.join('session-1', student, 'sock-1', meta);
      service.join(
        'session-1',
        { userId: 'student-2', name: 'Bruno', role: UserRole.ALUNO },
        'sock-2',
        meta,
      );

      service.raiseHand('session-1', 'student-2');
      service.raiseHand('session-1', 'student-1');

      expect(service.getRaisedHands('session-1').map((h) => h.userId)).toEqual([
        'student-2',
        'student-1',
      ]);
    });

    it('is idempotent: raising an already-raised hand returns null', () => {
      service.join('session-1', student, 'sock-1', meta);

      expect(service.raiseHand('session-1', 'student-1')).not.toBeNull();
      expect(service.raiseHand('session-1', 'student-1')).toBeNull();
      expect(service.getRaisedHands('session-1')).toHaveLength(1);
    });

    it('returns null for a non-participant', () => {
      service.join('session-1', teacher, 'sock-1', meta);

      expect(service.raiseHand('session-1', 'stranger')).toBeNull();
    });
  });

  describe('lowerHand', () => {
    it('lowers a raised hand', () => {
      service.join('session-1', student, 'sock-1', meta);
      service.raiseHand('session-1', 'student-1');

      expect(service.lowerHand('session-1', 'student-1')).toBe(true);
      expect(service.getRaisedHands('session-1')).toEqual([]);
    });

    it('is a no-op when the hand was not raised', () => {
      service.join('session-1', student, 'sock-1', meta);

      expect(service.lowerHand('session-1', 'student-1')).toBe(false);
    });
  });

  describe('removeSocket', () => {
    it('returns null for a socket that joined no room', () => {
      expect(service.removeSocket('ghost')).toBeNull();
    });

    it('keeps the user present while another socket remains', () => {
      service.join('session-1', student, 'sock-1', meta);
      service.join('session-1', student, 'sock-2', meta);

      const result = service.removeSocket('sock-1');

      expect(result).toEqual({
        sessionId: 'session-1',
        participant: student,
        lastSocket: false,
        hadRaisedHand: false,
      });
      expect(service.getParticipant('session-1', 'student-1')).toEqual(student);
    });

    it('fully removes the user on their last socket', () => {
      service.join('session-1', teacher, 'sock-1', meta);
      service.join('session-1', student, 'sock-2', meta);

      const result = service.removeSocket('sock-2');

      expect(result).toEqual({
        sessionId: 'session-1',
        participant: student,
        lastSocket: true,
        hadRaisedHand: false,
      });
      expect(service.getParticipants('session-1')).toEqual([teacher]);
    });

    it('reports hadRaisedHand when the departed user had a hand up', () => {
      service.join('session-1', student, 'sock-1', meta);
      service.raiseHand('session-1', 'student-1');

      const result = service.removeSocket('sock-1');

      expect(result?.hadRaisedHand).toBe(true);
      expect(service.getRaisedHands('session-1')).toEqual([]);
    });
  });

  describe('markEnded', () => {
    it('flips the cached status to ENDED', () => {
      service.join('session-1', student, 'sock-1', meta);

      service.markEnded('session-1');

      expect(service.getMeta('session-1')?.status).toBe(SessionStatus.ENDED);
    });
  });

  describe('closeSession', () => {
    it('drops all state and returns every affected socket id', () => {
      service.join('session-1', teacher, 'sock-1', meta);
      service.join('session-1', student, 'sock-2', meta);
      service.join('session-1', student, 'sock-3', meta);

      const socketIds = service.closeSession('session-1');

      expect(socketIds.sort()).toEqual(['sock-1', 'sock-2', 'sock-3']);
      expect(service.getMeta('session-1')).toBeUndefined();
      expect(service.getParticipants('session-1')).toEqual([]);
      expect(service.removeSocket('sock-1')).toBeNull();
    });

    it('returns an empty list for an unknown session', () => {
      expect(service.closeSession('ghost')).toEqual([]);
    });
  });

  describe('getMeta / getParticipant', () => {
    it('exposes the meta cached on join', () => {
      service.join('session-1', student, 'sock-1', meta);

      expect(service.getMeta('session-1')).toEqual(meta);
      expect(service.getMeta('ghost')).toBeUndefined();
    });

    it('finds a participant by user id', () => {
      service.join('session-1', student, 'sock-1', meta);

      expect(service.getParticipant('session-1', 'student-1')).toEqual(student);
      expect(service.getParticipant('session-1', 'ghost')).toBeUndefined();
    });
  });
});
