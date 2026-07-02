import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../../shared/enums/user-role.enum';
import { User } from '../auth/entities/user.entity';
import { UserRepository } from '../auth/repositories/user.repository';
import { ChatMessageWithAuthor } from '../sessions/entities/chat-message.entity';
import { SessionStatus } from '../sessions/entities/live-session.entity';
import { TranscriptSegment } from '../sessions/entities/transcript-segment.entity';
import {
  buildSession,
  buildSessionDetails,
} from '../sessions/testing/session-test.helpers';
import { AppendTranscriptSegmentUseCase } from '../sessions/usecases/append-transcript-segment.usecase';
import { EndSessionUseCase } from '../sessions/usecases/end-session.usecase';
import { GetSessionSnapshotUseCase } from '../sessions/usecases/get-session-snapshot.usecase';
import { SendChatMessageUseCase } from '../sessions/usecases/send-chat-message.usecase';
import {
  LiveParticipant,
  LiveRoomStateService,
} from './live-room-state.service';
import { LiveGateway } from './live.gateway';

type MockSocket = Socket & {
  data: { user?: LiveParticipant; sessionId?: string };
};

describe('LiveGateway', () => {
  let gateway: LiveGateway;
  let jwtService: jest.Mocked<JwtService>;
  let users: jest.Mocked<UserRepository>;
  let state: jest.Mocked<LiveRoomStateService>;
  let getSessionSnapshot: jest.Mocked<GetSessionSnapshotUseCase>;
  let appendTranscriptSegment: jest.Mocked<AppendTranscriptSegmentUseCase>;
  let sendChatMessage: jest.Mocked<SendChatMessageUseCase>;
  let endSession: jest.Mocked<EndSessionUseCase>;
  let serverEmit: jest.Mock;
  let socketsLeave: jest.Mock;
  let server: { to: jest.Mock; in: jest.Mock };

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
  const room = 'session:session-1';

  const buildSocket = (
    token?: string,
  ): { socket: MockSocket; roomEmit: jest.Mock } => {
    const roomEmit = jest.fn();
    const socket = {
      id: 'sock-1',
      data: {},
      handshake: { auth: { token } },
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      to: jest.fn(() => ({ emit: roomEmit })),
      disconnect: jest.fn(),
    } as unknown as MockSocket;
    return { socket, roomEmit };
  };

  const joinRoom = (
    socket: MockSocket,
    user: LiveParticipant,
    status: SessionStatus = SessionStatus.LIVE,
  ): void => {
    socket.data.user = user;
    socket.data.sessionId = 'session-1';
    state.getParticipant.mockReturnValue(user);
    state.getMeta.mockReturnValue({ teacherId: 'teacher-1', status });
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    state = {
      join: jest.fn(),
      removeSocket: jest.fn().mockReturnValue(null),
      getMeta: jest.fn(),
      markEnded: jest.fn(),
      getParticipant: jest.fn(),
      getParticipants: jest.fn().mockReturnValue([]),
      raiseHand: jest.fn(),
      lowerHand: jest.fn(),
      getRaisedHands: jest.fn().mockReturnValue([]),
      closeSession: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<LiveRoomStateService>;
    getSessionSnapshot = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetSessionSnapshotUseCase>;
    appendTranscriptSegment = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<AppendTranscriptSegmentUseCase>;
    sendChatMessage = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SendChatMessageUseCase>;
    endSession = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<EndSessionUseCase>;

    gateway = new LiveGateway(
      jwtService,
      users,
      state,
      getSessionSnapshot,
      appendTranscriptSegment,
      sendChatMessage,
      endSession,
    );

    serverEmit = jest.fn();
    socketsLeave = jest.fn();
    server = {
      to: jest.fn(() => ({ emit: serverEmit })),
      in: jest.fn(() => ({ socketsLeave })),
    };
    gateway.server = server as unknown as Server;
  });

  describe('handleConnection', () => {
    it('attaches the authenticated user to the socket', async () => {
      const { socket } = buildSocket('valid-jwt');
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'teacher-1',
        email: 'prof@semantia.app',
      });
      users.findById.mockResolvedValue(
        new User({
          id: 'teacher-1',
          name: 'Carlos Lima',
          email: 'prof@semantia.app',
          passwordHash: 'hash',
          role: UserRole.PROFESSOR,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      await gateway.handleConnection(socket);

      expect(socket.data.user).toEqual(teacher);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects a socket with an invalid token', async () => {
      const { socket } = buildSocket('bad-jwt');
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.data.user).toBeUndefined();
    });

    it('disconnects a socket without a token before verifying', async () => {
      const { socket } = buildSocket(undefined);

      await gateway.handleConnection(socket);

      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('session:join', () => {
    it('joins the room, emits session:state and broadcasts presence', async () => {
      // Arrange
      const { socket, roomEmit } = buildSocket();
      socket.data.user = student;
      const session = buildSessionDetails();
      const chatAt = new Date();
      const segAt = new Date();
      getSessionSnapshot.execute.mockResolvedValue({
        session,
        isOwner: false,
        chat: [
          new ChatMessageWithAuthor({
            id: 'msg-1',
            sessionId: 'session-1',
            userId: 'student-1',
            text: 'oi',
            createdAt: chatAt,
            name: 'Ana',
            role: UserRole.ALUNO,
          }),
        ],
        transcript: [
          new TranscriptSegment({
            id: 'seg-1',
            sessionId: 'session-1',
            seq: 1,
            text: 'Bom dia, turma',
            createdAt: segAt,
          }),
        ],
      });
      state.join.mockReturnValue({ firstJoin: true });
      state.getParticipants.mockReturnValue([student]);

      // Act
      const ack = await gateway.onSessionJoin(socket, {
        sessionId: 'session-1',
        token: 'tok_abc123',
      });

      // Assert
      expect(ack).toEqual({ ok: true });
      expect(getSessionSnapshot.execute).toHaveBeenCalledWith(
        'student-1',
        'session-1',
        'tok_abc123',
      );
      expect(state.join).toHaveBeenCalledWith('session-1', student, 'sock-1', {
        teacherId: 'teacher-1',
        status: SessionStatus.LIVE,
      });
      expect(socket.join).toHaveBeenCalledWith(room);
      expect(socket.data.sessionId).toBe('session-1');
      expect(socket.emit).toHaveBeenCalledWith('session:state', {
        session,
        participants: [student],
        raisedHands: [],
        chat: [
          {
            id: 'msg-1',
            userId: 'student-1',
            name: 'Ana',
            role: UserRole.ALUNO,
            text: 'oi',
            at: chatAt,
          },
        ],
        transcript: [{ seq: 1, text: 'Bom dia, turma', at: segAt }],
      });
      expect(socket.to).toHaveBeenCalledWith(room);
      expect(roomEmit).toHaveBeenCalledWith('presence:joined', {
        user: student,
      });
    });

    it('does not broadcast presence for an extra socket of the same user', async () => {
      const { socket, roomEmit } = buildSocket();
      socket.data.user = student;
      getSessionSnapshot.execute.mockResolvedValue({
        session: buildSessionDetails(),
        isOwner: false,
        chat: [],
        transcript: [],
      });
      state.join.mockReturnValue({ firstJoin: false });

      const ack = await gateway.onSessionJoin(socket, {
        sessionId: 'session-1',
      });

      expect(ack).toEqual({ ok: true });
      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('maps an access denial (403) to a FORBIDDEN ack', async () => {
      const { socket } = buildSocket();
      socket.data.user = student;
      getSessionSnapshot.execute.mockRejectedValue(
        new ForbiddenException('You do not have access to this session'),
      );

      const ack = await gateway.onSessionJoin(socket, {
        sessionId: 'session-1',
      });

      expect(ack).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have access to this session',
        },
      });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated socket', async () => {
      const { socket } = buildSocket();

      const ack = await gateway.onSessionJoin(socket, {
        sessionId: 'session-1',
      });

      expect(ack).toEqual({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Socket is not authenticated',
        },
      });
    });

    it('rejects a join without sessionId', async () => {
      const { socket } = buildSocket();
      socket.data.user = student;

      const ack = await gateway.onSessionJoin(socket, {});

      expect(ack).toEqual({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'sessionId is required' },
      });
    });
  });

  describe('transcript:partial', () => {
    it('broadcasts the partial text to the room for the owner', () => {
      const { socket, roomEmit } = buildSocket();
      joinRoom(socket, teacher);

      const ack = gateway.onTranscriptPartial(socket, { text: ' Bom dia ' });

      expect(ack).toEqual({ ok: true });
      expect(socket.to).toHaveBeenCalledWith(room);
      expect(roomEmit).toHaveBeenCalledWith('transcript:partial', {
        text: 'Bom dia',
        at: expect.any(Date) as Date,
      });
    });

    it('rejects a non-owner with FORBIDDEN', () => {
      const { socket, roomEmit } = buildSocket();
      joinRoom(socket, student);

      const ack = gateway.onTranscriptPartial(socket, { text: 'oi' });

      expect(ack).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the owning teacher can publish the transcript',
        },
      });
      expect(roomEmit).not.toHaveBeenCalled();
    });

    it('rejects writes after the session ended', () => {
      const { socket } = buildSocket();
      joinRoom(socket, teacher, SessionStatus.ENDED);

      const ack = gateway.onTranscriptPartial(socket, { text: 'oi' });

      expect(ack).toEqual({
        ok: false,
        error: {
          code: 'SESSION_ENDED',
          message: 'Session has already ended',
        },
      });
    });

    it('rejects a socket that has not joined a session', () => {
      const { socket } = buildSocket();
      socket.data.user = teacher;

      const ack = gateway.onTranscriptPartial(socket, { text: 'oi' });

      expect(ack).toEqual({
        ok: false,
        error: { code: 'NOT_JOINED', message: 'Join a session first' },
      });
    });
  });

  describe('transcript:final', () => {
    it('delegates persistence to the usecase and broadcasts the segment', async () => {
      const { socket } = buildSocket();
      joinRoom(socket, teacher);
      const segAt = new Date();
      appendTranscriptSegment.execute.mockResolvedValue(
        new TranscriptSegment({
          id: 'seg-1',
          sessionId: 'session-1',
          seq: 7,
          text: 'Bom dia, turma',
          createdAt: segAt,
        }),
      );

      const ack = await gateway.onTranscriptFinal(socket, {
        text: 'Bom dia, turma',
      });

      expect(ack).toEqual({ ok: true, seq: 7 });
      expect(appendTranscriptSegment.execute).toHaveBeenCalledWith(
        'teacher-1',
        'session-1',
        'Bom dia, turma',
      );
      expect(server.to).toHaveBeenCalledWith(room);
      expect(serverEmit).toHaveBeenCalledWith('transcript:final', {
        seq: 7,
        text: 'Bom dia, turma',
        at: segAt,
      });
    });

    it('maps a usecase rejection to an error ack', async () => {
      const { socket } = buildSocket();
      joinRoom(socket, student);
      appendTranscriptSegment.execute.mockRejectedValue(
        new ForbiddenException(
          'Only the owning teacher can write the transcript',
        ),
      );

      const ack = await gateway.onTranscriptFinal(socket, { text: 'oi' });

      expect(ack).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the owning teacher can write the transcript',
        },
      });
      expect(serverEmit).not.toHaveBeenCalled();
    });
  });

  describe('hand:raise', () => {
    it('rejects the teacher with FORBIDDEN', () => {
      const { socket } = buildSocket();
      joinRoom(socket, teacher);

      const ack = gateway.onHandRaise(socket);

      expect(ack).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'The teacher cannot raise a hand',
        },
      });
      expect(state.raiseHand).not.toHaveBeenCalled();
    });

    it('raises a student hand and broadcasts it to the room', () => {
      const { socket } = buildSocket();
      joinRoom(socket, student);
      const hand = { userId: 'student-1', name: 'Ana', at: new Date() };
      state.raiseHand.mockReturnValue(hand);

      const ack = gateway.onHandRaise(socket);

      expect(ack).toEqual({ ok: true });
      expect(state.raiseHand).toHaveBeenCalledWith('session-1', 'student-1');
      expect(server.to).toHaveBeenCalledWith(room);
      expect(serverEmit).toHaveBeenCalledWith('hand:raised', hand);
    });

    it('does not broadcast an already-raised hand', () => {
      const { socket } = buildSocket();
      joinRoom(socket, student);
      state.raiseHand.mockReturnValue(null);

      const ack = gateway.onHandRaise(socket);

      expect(ack).toEqual({ ok: true });
      expect(serverEmit).not.toHaveBeenCalled();
    });
  });

  describe('chat:send', () => {
    it('persists via the usecase and broadcasts the message', async () => {
      const { socket } = buildSocket();
      joinRoom(socket, student);
      const chatAt = new Date();
      sendChatMessage.execute.mockResolvedValue(
        new ChatMessageWithAuthor({
          id: 'msg-1',
          sessionId: 'session-1',
          userId: 'student-1',
          text: 'Tenho uma dúvida',
          createdAt: chatAt,
          name: 'Ana',
          role: UserRole.ALUNO,
        }),
      );

      const ack = await gateway.onChatSend(socket, {
        text: 'Tenho uma dúvida',
      });

      expect(ack).toEqual({ ok: true, id: 'msg-1' });
      expect(sendChatMessage.execute).toHaveBeenCalledWith(
        'student-1',
        'session-1',
        'Tenho uma dúvida',
      );
      expect(server.to).toHaveBeenCalledWith(room);
      expect(serverEmit).toHaveBeenCalledWith('chat:message', {
        id: 'msg-1',
        userId: 'student-1',
        name: 'Ana',
        role: UserRole.ALUNO,
        text: 'Tenho uma dúvida',
        at: chatAt,
      });
    });
  });

  describe('session:end', () => {
    it('ends the session, notifies the room and closes it', async () => {
      const { socket } = buildSocket();
      joinRoom(socket, teacher);
      const endedAt = new Date();
      endSession.execute.mockResolvedValue(
        buildSession({ status: SessionStatus.ENDED, endedAt }),
      );

      const ack = await gateway.onSessionEnd(socket);

      expect(ack).toEqual({ ok: true });
      expect(endSession.execute).toHaveBeenCalledWith('teacher-1', 'session-1');
      expect(state.markEnded).toHaveBeenCalledWith('session-1');
      expect(server.to).toHaveBeenCalledWith(room);
      expect(serverEmit).toHaveBeenCalledWith('session:ended', {
        sessionId: 'session-1',
        endedAt,
      });
      expect(state.closeSession).toHaveBeenCalledWith('session-1');
      expect(server.in).toHaveBeenCalledWith(room);
      expect(socketsLeave).toHaveBeenCalledWith(room);
      expect(socket.data.sessionId).toBeUndefined();
    });

    it('maps a non-owner rejection to FORBIDDEN', async () => {
      const { socket } = buildSocket();
      joinRoom(socket, student);
      endSession.execute.mockRejectedValue(
        new ForbiddenException('Only the owning teacher can end the session'),
      );

      const ack = await gateway.onSessionEnd(socket);

      expect(ack).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the owning teacher can end the session',
        },
      });
      expect(state.closeSession).not.toHaveBeenCalled();
    });
  });
});
