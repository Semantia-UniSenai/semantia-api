import { RoomParticipantRole } from '../rooms/entities/room.entity';
import { RoomPermissionService } from '../rooms/room-permission.service';
import { ChatMessage } from '../sessions/entities/chat-message.entity';
import {
  RoomSessionDetails,
  SessionStatus,
} from '../sessions/entities/live-session.entity';
import { LiveGateway } from './live.gateway';
import { LiveRoomStateService } from './live-room-state.service';

const details = new RoomSessionDetails({
  id: 'session-1',
  title: 'Reunião semanal',
  roomId: 'room-1',
  joinToken: 'tok_abc1234567890',
  status: SessionStatus.LIVE,
  createdAt: new Date(),
  startedAt: new Date(),
  endedAt: null,
  roomName: 'Planejamento',
  hostId: 'host-1',
  hostName: 'Ana',
});

function setup(
  role: RoomParticipantRole,
  kind: 'account' | 'guest' = 'account',
) {
  const state = new LiveRoomStateService();
  const snapshot = {
    execute: jest.fn().mockResolvedValue({
      session: details,
      role,
      canManage:
        role === RoomParticipantRole.HOST ||
        role === RoomParticipantRole.MODERATOR,
      chat: [],
      transcript: [],
    }),
  };
  const append = { execute: jest.fn() };
  const chat = {
    execute: jest.fn().mockResolvedValue(
      new ChatMessage({
        id: 'message-1',
        sessionId: details.id,
        participantId: kind === 'guest' ? 'guest:1' : 'account-1',
        participantName: 'Pessoa',
        participantRole: role,
        text: 'Olá',
        createdAt: new Date(),
      }),
    ),
  };
  const end = {
    execute: jest
      .fn()
      .mockResolvedValue({ ...details, status: SessionStatus.ENDED }),
  };
  const gateway = new LiveGateway(
    {} as never,
    {} as never,
    {} as never,
    new RoomPermissionService(),
    state,
    snapshot as never,
    append as never,
    chat as never,
    end as never,
  );
  const serverEmit = jest.fn();
  (gateway as unknown as { server: unknown }).server = {
    to: jest.fn(() => ({ emit: serverEmit })),
    in: jest.fn(() => ({ socketsLeave: jest.fn() })),
  };
  const socketEmit = jest.fn();
  const roomEmit = jest.fn();
  const socket = {
    id: 'socket-1',
    data: {
      identity: {
        participantId: kind === 'guest' ? 'guest:1' : 'account-1',
        name: 'Pessoa',
        role,
        kind,
        ...(kind === 'guest' ? { sessionId: details.id } : {}),
      },
    },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    emit: socketEmit,
    to: jest.fn(() => ({ emit: roomEmit })),
  };
  return {
    gateway,
    socket,
    snapshot,
    append,
    chat,
    end,
    socketEmit,
    serverEmit,
  };
}

describe('LiveGateway generic identities', () => {
  it.each([RoomParticipantRole.HOST, RoomParticipantRole.MODERATOR])(
    'joins a %s and exposes contextual management permission',
    async (role) => {
      const { gateway, socket, socketEmit } = setup(role);
      await expect(
        gateway.onSessionJoin(socket as never, { sessionId: details.id }),
      ).resolves.toEqual({ ok: true });
      expect(socketEmit).toHaveBeenCalledWith(
        'session:state',
        expect.objectContaining({
          canManage: true,
          self: expect.objectContaining({ role }),
        }),
      );
    },
  );

  it('allows a guest to chat using an ephemeral identity', async () => {
    const { gateway, socket, chat } = setup(RoomParticipantRole.GUEST, 'guest');
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });
    await expect(
      gateway.onChatSend(socket as never, { text: 'Olá' }),
    ).resolves.toEqual({ ok: true, id: 'message-1' });
    expect(chat.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: 'guest:1',
        role: RoomParticipantRole.GUEST,
      }),
      details.id,
      'Olá',
    );
  });

  it('never lets a guest publish final transcript segments', async () => {
    const { gateway, socket, append } = setup(
      RoomParticipantRole.GUEST,
      'guest',
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });
    await expect(
      gateway.onTranscriptFinal(socket as never, { text: 'segredo' }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Guests cannot publish the transcript',
      },
    });
    expect(append.execute).not.toHaveBeenCalled();
  });

  it('never lets a moderator publish partial or final transcript segments', async () => {
    const { gateway, socket, append, serverEmit } = setup(
      RoomParticipantRole.MODERATOR,
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    expect(
      gateway.onTranscriptPartial(socket as never, {
        text: 'parcial indevida',
      }),
    ).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the host can publish the transcript',
      },
    });
    await expect(
      gateway.onTranscriptFinal(socket as never, {
        text: 'final indevida',
        clientSegmentId: 'segment-moderator-1',
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the host can publish the transcript',
      },
    });
    expect(append.execute).not.toHaveBeenCalled();
    expect(serverEmit).not.toHaveBeenCalledWith(
      'transcript:final',
      expect.anything(),
    );
  });

  it('acknowledges a retried final segment without broadcasting it twice', async () => {
    const { gateway, socket, append, serverEmit } = setup(
      RoomParticipantRole.HOST,
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });
    const segment = {
      id: 'segment-1',
      sessionId: details.id,
      clientSegmentId: 'segment-client-1',
      seq: 1,
      text: 'Texto acessível',
      createdAt: new Date(),
    };
    append.execute.mockResolvedValue({ segment, created: false });

    await expect(
      gateway.onTranscriptFinal(socket as never, {
        text: 'Texto acessível',
        clientSegmentId: 'segment-client-1',
      }),
    ).resolves.toEqual({ ok: true, seq: 1, replayed: true });
    expect(append.execute).toHaveBeenCalledWith(
      'account-1',
      details.id,
      'Texto acessível',
      'segment-client-1',
    );
    expect(serverEmit).not.toHaveBeenCalledWith(
      'transcript:final',
      expect.anything(),
    );
  });
});
