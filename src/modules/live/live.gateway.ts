import { randomUUID } from 'crypto';
import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserRepository } from '../auth/repositories/user.repository';
import { AsrClientError } from '../asr/asr-client';
import { parseAudioSegment } from '../asr/audio-segment';
import { TranscribeAudioSegmentUseCase } from '../asr/usecases/transcribe-audio-segment.usecase';
import { RoomParticipantRole } from '../rooms/entities/room.entity';
import { RoomPermissionService } from '../rooms/room-permission.service';
import { SessionStatus } from '../sessions/entities/live-session.entity';
import { RoomSessionRepository } from '../sessions/repositories/live-session.repository';
import { EndSessionUseCase } from '../sessions/usecases/end-session.usecase';
import { GetSessionSnapshotUseCase } from '../sessions/usecases/get-session-snapshot.usecase';
import { SendChatMessageUseCase } from '../sessions/usecases/send-chat-message.usecase';
import {
  LiveParticipant,
  LiveRoomStateService,
} from './live-room-state.service';

export type Ack<T = unknown> =
  ({ ok: true } & T) | { ok: false; error: { code: string; message: string } };

interface SocketIdentity extends LiveParticipant {
  kind: 'account' | 'guest';
  sessionId?: string;
}

interface SocketData {
  identity?: SocketIdentity;
  sessionId?: string;
}

interface AdmissionEntry {
  admissionId: string;
  socket: LiveSocket;
  displayName: string;
  isGuest: boolean;
  requestedAt: string;
  sessionId: string;
  principal: {
    participantId: string;
    kind: 'account' | 'guest';
    sessionId?: string;
  };
  joinToken?: string;
}

type AnyEventsMap = Record<string, (...args: any[]) => void>;
type LiveSocket = Socket<AnyEventsMap, AnyEventsMap, AnyEventsMap, SocketData>;

const roomOf = (sessionId: string): string => `session:${sessionId}`;
const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'SESSION_READ_ONLY',
};

@WebSocketGateway({
  namespace: '/live',
  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  },
  maxHttpBufferSize: 1_100_000,
})
export class LiveGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);
  private readonly admissionQueues = new Map<
    string,
    Map<string, AdmissionEntry>
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly users: UserRepository,
    private readonly sessions: RoomSessionRepository,
    private readonly permissions: RoomPermissionService,
    private readonly state: LiveRoomStateService,
    private readonly getSessionSnapshot: GetSessionSnapshotUseCase,
    private readonly sendChatMessage: SendChatMessageUseCase,
    private readonly endSession: EndSessionUseCase,
    private readonly transcribeAudioSegment: TranscribeAudioSegmentUseCase,
  ) {}

  afterInit(server: Server): void {
    server.use((socket: LiveSocket, next: (error?: Error) => void) => {
      this.authenticate(socket)
        .then(() => next())
        .catch(() => next(new Error('UNAUTHORIZED')));
    });
  }

  private async authenticate(socket: LiveSocket): Promise<void> {
    const token = (socket.handshake.auth as { token?: string })?.token;
    if (!token) throw new Error('missing token');
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      email?: string;
      kind?: 'account' | 'guest';
      name?: string;
      sessionId?: string;
    }>(token);

    if (payload.kind === 'guest') {
      if (!payload.name || !payload.sessionId)
        throw new Error('invalid guest token');
      const session = await this.sessions.findById(payload.sessionId);
      if (
        !session ||
        (session.status !== SessionStatus.LIVE &&
          session.status !== SessionStatus.ENDED)
      ) {
        throw new Error('guest session unavailable');
      }
      socket.data.identity = {
        participantId: payload.sub,
        name: payload.name,
        role: RoomParticipantRole.GUEST,
        kind: 'guest',
        sessionId: payload.sessionId,
      };
      return;
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new Error('user not found');
    socket.data.identity = {
      participantId: user.id,
      name: user.name,
      role: RoomParticipantRole.PARTICIPANT,
      kind: 'account',
    };
  }

  handleDisconnect(socket: LiveSocket): void {
    this.removeFromAdmissionQueue(socket);
    this.dropSocket(socket);
  }

  @SubscribeMessage('session:join')
  async onSessionJoin(
    socket: LiveSocket,
    body: { sessionId?: string; token?: string },
  ): Promise<Ack> {
    try {
      const identity = this.requireIdentity(socket);
      if (!body?.sessionId || typeof body.sessionId !== 'string') {
        return this.errorAck('BAD_REQUEST', 'sessionId is required');
      }
      const snapshot = await this.getSessionSnapshot.execute(
        {
          participantId: identity.participantId,
          kind: identity.kind,
          sessionId: identity.sessionId,
        },
        body.sessionId,
        body.token,
      );
      identity.role = snapshot.role;

      if (snapshot.session.requiresApproval && !snapshot.canManage) {
        return this.queueForAdmission(
          socket,
          identity,
          body.sessionId,
          body.token,
        );
      }

      if (socket.data.sessionId && socket.data.sessionId !== body.sessionId) {
        this.leaveCurrentRoom(socket);
      }
      const { firstJoin } = this.state.join(
        body.sessionId,
        identity,
        socket.id,
        { status: snapshot.session.status },
      );
      await socket.join(roomOf(body.sessionId));
      socket.data.sessionId = body.sessionId;

      socket.emit('session:state', {
        session: snapshot.session,
        canManage: snapshot.canManage,
        self: identity,
        participants: this.state.getParticipants(body.sessionId),
        raisedHands: this.state.getRaisedHands(body.sessionId),
        admissionQueue: snapshot.canManage
          ? this.getAdmissionQueueEntries(body.sessionId)
          : [],
        chat: snapshot.chat.map((message) => ({
          id: message.id,
          participantId: message.participantId,
          name: message.participantName,
          role: message.participantRole,
          text: message.text,
          at: message.createdAt,
        })),
        transcript: snapshot.transcript.map((segment) => ({
          seq: segment.seq,
          text: segment.text,
          at: segment.createdAt,
        })),
      });
      if (firstJoin) {
        socket.to(roomOf(body.sessionId)).emit('presence:joined', {
          participant: identity,
        });
      }
      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('session:leave')
  onSessionLeave(socket: LiveSocket): Ack {
    this.leaveCurrentRoom(socket);
    return { ok: true };
  }

  @SubscribeMessage('admission:approve')
  async onAdmissionApprove(
    socket: LiveSocket,
    body: { admissionId?: string },
  ): Promise<Ack> {
    try {
      const { identity, sessionId } = this.requireParticipant(socket);
      if (!this.permissions.canManage(identity.role)) {
        return this.errorAck(
          'FORBIDDEN',
          'Only a host or moderator can approve admissions',
        );
      }
      const sessionQueue = this.admissionQueues.get(sessionId);
      const entry = sessionQueue?.get(body?.admissionId ?? '');
      if (!entry) {
        return this.errorAck('NOT_FOUND', 'Admission request not found');
      }
      sessionQueue!.delete(entry.admissionId);

      const snapshot = await this.getSessionSnapshot.execute(
        entry.principal,
        sessionId,
        entry.joinToken,
      );
      if (!entry.socket.data.identity) return { ok: true };
      entry.socket.data.identity.role = snapshot.role;
      const candidateIdentity = entry.socket.data.identity;

      const { firstJoin } = this.state.join(
        sessionId,
        candidateIdentity,
        entry.socket.id,
        { status: snapshot.session.status },
      );
      await entry.socket.join(roomOf(sessionId));
      entry.socket.data.sessionId = sessionId;

      entry.socket.emit('session:state', {
        session: snapshot.session,
        canManage: snapshot.canManage,
        self: candidateIdentity,
        participants: this.state.getParticipants(sessionId),
        raisedHands: this.state.getRaisedHands(sessionId),
        admissionQueue: [],
        chat: snapshot.chat.map((m) => ({
          id: m.id,
          participantId: m.participantId,
          name: m.participantName,
          role: m.participantRole,
          text: m.text,
          at: m.createdAt,
        })),
        transcript: snapshot.transcript.map((s) => ({
          seq: s.seq,
          text: s.text,
          at: s.createdAt,
        })),
      });

      if (firstJoin) {
        entry.socket.to(roomOf(sessionId)).emit('presence:joined', {
          participant: candidateIdentity,
        });
      }

      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('admission:reject')
  onAdmissionReject(socket: LiveSocket, body: { admissionId?: string }): Ack {
    try {
      const { identity, sessionId } = this.requireParticipant(socket);
      if (!this.permissions.canManage(identity.role)) {
        return this.errorAck(
          'FORBIDDEN',
          'Only a host or moderator can reject admissions',
        );
      }
      const sessionQueue = this.admissionQueues.get(sessionId);
      const entry = sessionQueue?.get(body?.admissionId ?? '');
      if (!entry) {
        return this.errorAck('NOT_FOUND', 'Admission request not found');
      }
      sessionQueue!.delete(entry.admissionId);
      entry.socket.emit('admission:denied', {
        message:
          'Seu acesso à sala não foi aceito. Entre em contato com o anfitrião.',
      });
      entry.socket.disconnect(true);
      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('transcription:audio')
  async onTranscriptionAudio(
    socket: LiveSocket,
    body: unknown,
  ): Promise<
    Ack<{
      seq: number | null;
      replayed: boolean;
      engine: string | null;
      model: string | null;
      inferenceMs: number | null;
    }>
  > {
    let clientSegmentId: string | null = null;
    try {
      const { identity, sessionId, status } = this.requireParticipant(socket);
      if (
        identity.kind !== 'account' ||
        identity.role !== RoomParticipantRole.HOST
      ) {
        return this.errorAck(
          'FORBIDDEN',
          'Only the host can publish the transcript',
        );
      }
      if (status !== SessionStatus.LIVE) {
        return this.errorAck('SESSION_READ_ONLY', 'Session is read-only');
      }

      const audio = parseAudioSegment(body);
      clientSegmentId = audio.clientSegmentId;
      socket.emit('transcription:status', {
        clientSegmentId,
        state: 'processing',
      });
      const result = await this.transcribeAudioSegment.execute(
        identity.participantId,
        sessionId,
        audio,
      );
      if (result.created && result.segment) {
        this.server.to(roomOf(sessionId)).emit('transcript:final', {
          seq: result.segment.seq,
          text: result.segment.text,
          at: result.segment.createdAt,
        });
      }
      socket.emit('transcription:status', {
        clientSegmentId,
        state: 'complete',
        engine: result.engine,
        model: result.model,
        inferenceMs: result.inferenceMs,
      });
      return {
        ok: true,
        seq: result.segment?.seq ?? null,
        replayed: result.replayed,
        engine: result.engine,
        model: result.model,
        inferenceMs: result.inferenceMs,
      };
    } catch (error) {
      const ack = this.toErrorAck(error);
      if (clientSegmentId) {
        socket.emit('transcription:status', {
          clientSegmentId,
          state: 'failed',
          code: ack.error.code,
        });
      }
      return ack;
    }
  }

  @SubscribeMessage('hand:raise')
  onHandRaise(socket: LiveSocket): Ack {
    try {
      const { identity, sessionId, status } = this.requireParticipant(socket);
      if (this.permissions.canManage(identity.role)) {
        return this.errorAck('FORBIDDEN', 'Room managers cannot raise a hand');
      }
      if (status !== SessionStatus.LIVE) {
        return this.errorAck('SESSION_READ_ONLY', 'Session is read-only');
      }
      const hand = this.state.raiseHand(sessionId, identity.participantId);
      if (hand) this.server.to(roomOf(sessionId)).emit('hand:raised', hand);
      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('hand:lower')
  onHandLower(socket: LiveSocket): Ack {
    try {
      const { identity, sessionId, status } = this.requireParticipant(socket);
      if (status !== SessionStatus.LIVE) {
        return this.errorAck('SESSION_READ_ONLY', 'Session is read-only');
      }
      if (this.state.lowerHand(sessionId, identity.participantId)) {
        this.server.to(roomOf(sessionId)).emit('hand:lowered', {
          participantId: identity.participantId,
        });
      }
      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('chat:send')
  async onChatSend(
    socket: LiveSocket,
    body: { text?: string },
  ): Promise<Ack<{ id: string }>> {
    try {
      const { identity, sessionId } = this.requireParticipant(socket);
      const message = await this.sendChatMessage.execute(
        {
          participantId: identity.participantId,
          name: identity.name,
          role: identity.role,
        },
        sessionId,
        body?.text ?? '',
      );
      this.server.to(roomOf(sessionId)).emit('chat:message', {
        id: message.id,
        participantId: message.participantId,
        name: message.participantName,
        role: message.participantRole,
        text: message.text,
        at: message.createdAt,
      });
      return { ok: true, id: message.id };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('session:end')
  async onSessionEnd(socket: LiveSocket): Promise<Ack> {
    try {
      const { identity, sessionId } = this.requireParticipant(socket);
      if (identity.kind !== 'account') {
        return this.errorAck('FORBIDDEN', 'Guests cannot end a session');
      }
      const session = await this.endSession.execute(
        identity.participantId,
        sessionId,
      );
      this.state.markEnded(sessionId);

      const sessionQueue = this.admissionQueues.get(sessionId);
      if (sessionQueue) {
        for (const entry of sessionQueue.values()) {
          entry.socket.emit('admission:denied', {
            message: 'A reunião foi encerrada.',
          });
          entry.socket.disconnect(true);
        }
        this.admissionQueues.delete(sessionId);
      }

      this.server.to(roomOf(sessionId)).emit('session:ended', {
        sessionId,
        endedAt: session.endedAt,
      });
      this.state.closeSession(sessionId);
      this.server.in(roomOf(sessionId)).socketsLeave(roomOf(sessionId));
      socket.data.sessionId = undefined;
      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  private queueForAdmission(
    socket: LiveSocket,
    identity: SocketIdentity,
    sessionId: string,
    joinToken?: string,
  ): Ack {
    const admissionId = randomUUID();
    let sessionQueue = this.admissionQueues.get(sessionId);
    if (!sessionQueue) {
      sessionQueue = new Map();
      this.admissionQueues.set(sessionId, sessionQueue);
    }
    const entry: AdmissionEntry = {
      admissionId,
      socket,
      displayName: identity.name,
      isGuest: identity.kind === 'guest',
      requestedAt: new Date().toISOString(),
      sessionId,
      principal: {
        participantId: identity.participantId,
        kind: identity.kind,
        sessionId: identity.sessionId,
      },
      joinToken,
    };
    sessionQueue.set(admissionId, entry);

    socket.emit('admission:waiting', { admissionId });

    const hostSocket = this.getHostSocket(sessionId);
    if (hostSocket) {
      hostSocket.emit('admission:request', {
        admissionId,
        displayName: identity.name,
        isGuest: identity.kind === 'guest',
        requestedAt: entry.requestedAt,
      });
    }

    return { ok: true };
  }

  private getHostSocket(sessionId: string): LiveSocket | null {
    const room = this.server.sockets.adapter.rooms.get(roomOf(sessionId));
    if (!room) return null;
    for (const socketId of room) {
      const s = this.server.sockets.sockets.get(socketId) as
        LiveSocket | undefined;
      if (s?.data?.identity?.role === RoomParticipantRole.HOST) return s;
    }
    return null;
  }

  private getAdmissionQueueEntries(sessionId: string): Array<{
    admissionId: string;
    displayName: string;
    isGuest: boolean;
    requestedAt: string;
  }> {
    const queue = this.admissionQueues.get(sessionId);
    if (!queue) return [];
    return Array.from(queue.values()).map(
      ({ admissionId, displayName, isGuest, requestedAt }) => ({
        admissionId,
        displayName,
        isGuest,
        requestedAt,
      }),
    );
  }

  private removeFromAdmissionQueue(socket: LiveSocket): void {
    for (const [sessionId, queue] of this.admissionQueues) {
      for (const [admissionId, entry] of queue) {
        if (entry.socket.id === socket.id) {
          queue.delete(admissionId);
          if (queue.size === 0) this.admissionQueues.delete(sessionId);
          return;
        }
      }
    }
  }

  private requireIdentity(socket: LiveSocket): SocketIdentity {
    if (!socket.data.identity) {
      throw new WsError('UNAUTHORIZED', 'Socket is not authenticated');
    }
    return socket.data.identity;
  }

  private requireParticipant(socket: LiveSocket): {
    identity: SocketIdentity;
    sessionId: string;
    status: SessionStatus;
  } {
    const identity = this.requireIdentity(socket);
    const sessionId = socket.data.sessionId;
    if (
      !sessionId ||
      !this.state.getParticipant(sessionId, identity.participantId)
    ) {
      throw new WsError('NOT_JOINED', 'Join a session first');
    }
    const meta = this.state.getMeta(sessionId);
    if (!meta) throw new WsError('NOT_JOINED', 'Join a session first');
    return { identity, sessionId, status: meta.status };
  }

  private dropSocket(socket: LiveSocket): void {
    const result = this.state.removeSocket(socket.id);
    if (!result || !result.lastSocket) return;
    const room = roomOf(result.sessionId);
    if (result.hadRaisedHand) {
      socket.to(room).emit('hand:lowered', {
        participantId: result.participant.participantId,
      });
    }
    socket.to(room).emit('presence:left', {
      participantId: result.participant.participantId,
    });
  }

  private leaveCurrentRoom(socket: LiveSocket): void {
    const sessionId = socket.data.sessionId;
    this.dropSocket(socket);
    if (sessionId) {
      void socket.leave(roomOf(sessionId));
      socket.data.sessionId = undefined;
    }
  }

  private errorAck(
    code: string,
    message: string,
  ): {
    ok: false;
    error: { code: string; message: string };
  } {
    return { ok: false, error: { code, message } };
  }

  private toErrorAck(error: unknown): {
    ok: false;
    error: { code: string; message: string };
  } {
    if (error instanceof WsError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    if (error instanceof AsrClientError) {
      return {
        ok: false,
        error: { code: error.code, message: error.message },
      };
    }
    if (error instanceof HttpException) {
      return {
        ok: false,
        error: {
          code: CODE_BY_STATUS[error.getStatus()] ?? 'ERROR',
          message: error.message,
        },
      };
    }
    this.logger.error(
      'Unexpected gateway error',
      error instanceof Error ? error.stack : String(error),
    );
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Unexpected error' },
    };
  }
}

class WsError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
