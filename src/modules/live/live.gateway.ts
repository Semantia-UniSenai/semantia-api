import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayInit,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../../shared/enums/user-role.enum';
import { UserRepository } from '../auth/repositories/user.repository';
import { SessionStatus } from '../sessions/entities/live-session.entity';
import { MAX_TRANSCRIPT_SEGMENT_LENGTH } from '../sessions/usecases/append-transcript-segment.usecase';
import { AppendTranscriptSegmentUseCase } from '../sessions/usecases/append-transcript-segment.usecase';
import { EndSessionUseCase } from '../sessions/usecases/end-session.usecase';
import { GetSessionSnapshotUseCase } from '../sessions/usecases/get-session-snapshot.usecase';
import { SendChatMessageUseCase } from '../sessions/usecases/send-chat-message.usecase';
import {
  LiveParticipant,
  LiveRoomStateService,
} from './live-room-state.service';

/** Every client→server event is acknowledged with one of these. */
export type Ack<T = unknown> =
  ({ ok: true } & T) | { ok: false; error: { code: string; message: string } };

interface SocketData {
  user?: LiveParticipant;
  sessionId?: string;
}

// Espelho local do DefaultEventsMap do socket.io (o subpath
// `socket.io/dist/typed-events` é bloqueado pelo exports map do pacote).
type AnyEventsMap = Record<string, (...args: any[]) => void>;

// O 4º genérico tipa `socket.data`; a interseção (`Socket & {...}`) não
// funciona porque o default de `data` é `any` e engoliria o tipo.
type LiveSocket = Socket<AnyEventsMap, AnyEventsMap, AnyEventsMap, SocketData>;

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'SESSION_ENDED',
};

const roomOf = (sessionId: string): string => `session:${sessionId}`;

/**
 * LiveGateway — Socket.IO namespace `/live` for the live classroom.
 *
 * Thin by design: it authenticates the handshake, tracks presence via
 * LiveRoomStateService and delegates every business decision (access,
 * ownership, persistence) to the sessions usecases — the same ones the REST
 * API uses.
 *
 * Protocol (client → server, all acked with `{ ok }` or
 * `{ ok: false, error: { code, message } }`):
 * - `session:join { sessionId, token? }` → emits `session:state` to caller,
 *   broadcasts `presence:joined`.
 * - `session:leave` → broadcasts `presence:left` (and `hand:lowered`).
 * - `transcript:partial { text }` (owner only, not persisted) → broadcasts
 *   `transcript:partial { text, at }`.
 * - `transcript:final { text }` (owner only, persisted) → broadcasts
 *   `transcript:final { seq, text, at }`.
 * - `hand:raise` / `hand:lower` (students) → broadcasts
 *   `hand:raised { userId, name, at }` / `hand:lowered { userId }`.
 * - `chat:send { text }` → broadcasts
 *   `chat:message { id, userId, name, role, text, at }`.
 * - `session:end` (owner only) → broadcasts `session:ended`, closes the room.
 *
 * Joining an ENDED session is allowed (read-only transcript replay); writes
 * (transcript/chat/hands) are rejected with code `SESSION_ENDED`.
 */
@WebSocketGateway({
  namespace: '/live',
  cors: {
    // Same policy as main.ts. Read from process.env because decorator
    // metadata is evaluated before Nest's ConfigModule loads.
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  },
})
export class LiveGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly users: UserRepository,
    private readonly state: LiveRoomStateService,
    private readonly getSessionSnapshot: GetSessionSnapshotUseCase,
    private readonly appendTranscriptSegment: AppendTranscriptSegmentUseCase,
    private readonly sendChatMessage: SendChatMessageUseCase,
    private readonly endSession: EndSessionUseCase,
  ) {}

  /**
   * Auth no middleware do namespace — roda na fase de handshake, ANTES de o
   * socket ser entregue e de qualquer evento ser processado. Autenticar em
   * `handleConnection` (async) abre uma corrida: um `session:join` emitido
   * logo no `connect` chegaria antes do JWT ser verificado.
   * Falha → cliente recebe `connect_error` com message `UNAUTHORIZED`.
   */
  afterInit(server: Server): void {
    server.use((socket: LiveSocket, next: (err?: Error) => void) => {
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
      email: string;
      role?: UserRole;
    }>(token);

    const user = await this.users.findById(payload.sub);
    if (!user) throw new Error('user not found');

    socket.data.user = {
      userId: user.id,
      name: user.name,
      role: user.role,
    };
  }

  handleDisconnect(socket: LiveSocket): void {
    this.dropSocket(socket);
  }

  @SubscribeMessage('session:join')
  async onSessionJoin(
    socket: LiveSocket,
    body: { sessionId?: string; token?: string },
  ): Promise<Ack> {
    try {
      const user = this.requireUser(socket);
      if (!body?.sessionId || typeof body.sessionId !== 'string') {
        return this.errorAck('BAD_REQUEST', 'sessionId is required');
      }

      // Shared access rule + full room snapshot in one usecase call.
      const snapshot = await this.getSessionSnapshot.execute(
        user.userId,
        body.sessionId,
        body.token,
      );
      const { session } = snapshot;

      // A socket lives in at most one session room.
      if (socket.data.sessionId && socket.data.sessionId !== session.id) {
        this.leaveCurrentRoom(socket);
      }

      const { firstJoin } = this.state.join(session.id, user, socket.id, {
        teacherId: session.teacherId,
        status: session.status,
      });
      await socket.join(roomOf(session.id));
      socket.data.sessionId = session.id;

      socket.emit('session:state', {
        session,
        participants: this.state.getParticipants(session.id),
        raisedHands: this.state.getRaisedHands(session.id),
        chat: snapshot.chat.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.name,
          role: m.role,
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
        socket.to(roomOf(session.id)).emit('presence:joined', { user });
      }

      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('session:leave')
  onSessionLeave(socket: LiveSocket): Ack {
    this.dropSocket(socket);
    if (socket.data.sessionId) {
      void socket.leave(roomOf(socket.data.sessionId));
      socket.data.sessionId = undefined;
    }
    return { ok: true };
  }

  @SubscribeMessage('transcript:partial')
  onTranscriptPartial(socket: LiveSocket, body: { text?: string }): Ack {
    try {
      const { user, sessionId, meta } = this.requireParticipant(socket);
      if (meta.teacherId !== user.userId) {
        return this.errorAck(
          'FORBIDDEN',
          'Only the owning teacher can publish the transcript',
        );
      }
      if (meta.status !== SessionStatus.LIVE) {
        return this.errorAck('SESSION_ENDED', 'Session has already ended');
      }
      const text = body?.text?.trim();
      if (!text || text.length > MAX_TRANSCRIPT_SEGMENT_LENGTH) {
        return this.errorAck('BAD_REQUEST', 'Invalid transcript text');
      }

      // Ephemeral: not persisted, just fanned out to the room.
      socket
        .to(roomOf(sessionId))
        .emit('transcript:partial', { text, at: new Date() });
      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('transcript:final')
  async onTranscriptFinal(
    socket: LiveSocket,
    body: { text?: string },
  ): Promise<Ack<{ seq: number | null }>> {
    try {
      const { user, sessionId } = this.requireParticipant(socket);

      // Usecase re-validates ownership + LIVE status against the database,
      // and strips disfluencies before persisting.
      const segment = await this.appendTranscriptSegment.execute(
        user.userId,
        sessionId,
        body?.text ?? '',
      );

      // Frase que era 100% ruído ("né?"): nada persistido, nada emitido.
      if (!segment) {
        return { ok: true, seq: null };
      }

      this.server.to(roomOf(sessionId)).emit('transcript:final', {
        seq: segment.seq,
        text: segment.text,
        at: segment.createdAt,
      });
      return { ok: true, seq: segment.seq };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('hand:raise')
  onHandRaise(socket: LiveSocket): Ack {
    try {
      const { user, sessionId, meta } = this.requireParticipant(socket);
      if (meta.teacherId === user.userId) {
        return this.errorAck('FORBIDDEN', 'The teacher cannot raise a hand');
      }
      if (meta.status !== SessionStatus.LIVE) {
        return this.errorAck('SESSION_ENDED', 'Session has already ended');
      }

      const hand = this.state.raiseHand(sessionId, user.userId);
      if (hand) {
        // Includes the raiser: every client keeps the same ordered list.
        this.server.to(roomOf(sessionId)).emit('hand:raised', hand);
      }
      return { ok: true };
    } catch (error) {
      return this.toErrorAck(error);
    }
  }

  @SubscribeMessage('hand:lower')
  onHandLower(socket: LiveSocket): Ack {
    try {
      const { user, sessionId, meta } = this.requireParticipant(socket);
      if (meta.status !== SessionStatus.LIVE) {
        return this.errorAck('SESSION_ENDED', 'Session has already ended');
      }

      if (this.state.lowerHand(sessionId, user.userId)) {
        this.server
          .to(roomOf(sessionId))
          .emit('hand:lowered', { userId: user.userId });
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
      const { user, sessionId } = this.requireParticipant(socket);

      const message = await this.sendChatMessage.execute(
        user.userId,
        sessionId,
        body?.text ?? '',
      );

      this.server.to(roomOf(sessionId)).emit('chat:message', {
        id: message.id,
        userId: message.userId,
        name: message.name,
        role: message.role,
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
      const { user, sessionId } = this.requireParticipant(socket);

      // Usecase enforces ownership and is idempotent.
      const session = await this.endSession.execute(user.userId, sessionId);

      this.state.markEnded(sessionId);
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

  /** Presence bookkeeping shared by `session:leave` and disconnects. */
  private dropSocket(socket: LiveSocket): void {
    const result = this.state.removeSocket(socket.id);
    if (!result || !result.lastSocket) return;

    const room = roomOf(result.sessionId);
    if (result.hadRaisedHand) {
      socket
        .to(room)
        .emit('hand:lowered', { userId: result.participant.userId });
    }
    socket.to(room).emit('presence:left', {
      userId: result.participant.userId,
    });
  }

  private leaveCurrentRoom(socket: LiveSocket): void {
    this.dropSocket(socket);
    if (socket.data.sessionId) {
      void socket.leave(roomOf(socket.data.sessionId));
      socket.data.sessionId = undefined;
    }
  }

  private requireUser(socket: LiveSocket): LiveParticipant {
    if (!socket.data.user) {
      throw new WsError('UNAUTHORIZED', 'Socket is not authenticated');
    }
    return socket.data.user;
  }

  private requireParticipant(socket: LiveSocket): {
    user: LiveParticipant;
    sessionId: string;
    meta: { teacherId: string; status: SessionStatus };
  } {
    const user = this.requireUser(socket);
    const sessionId = socket.data.sessionId;
    if (!sessionId || !this.state.getParticipant(sessionId, user.userId)) {
      throw new WsError('NOT_JOINED', 'Join a session first');
    }
    const meta = this.state.getMeta(sessionId);
    if (!meta) {
      throw new WsError('NOT_JOINED', 'Join a session first');
    }
    return { user, sessionId, meta };
  }

  private errorAck(code: string, message: string): Ack {
    return { ok: false, error: { code, message } };
  }

  private toErrorAck(error: unknown): {
    ok: false;
    error: { code: string; message: string };
  } {
    if (error instanceof WsError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    if (error instanceof HttpException) {
      const code = CODE_BY_STATUS[error.getStatus()] ?? 'ERROR';
      return { ok: false, error: { code, message: error.message } };
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

/** Internal control-flow error carrying a stable ack code. */
class WsError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
