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
  requiresApproval: false,
  audienceContext: null,
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
  const transcribeAudio = { execute: jest.fn() };
  const gateway = new (LiveGateway as any)(
    {},
    {},
    {},
    new RoomPermissionService(),
    state,
    snapshot,
    chat,
    end,
    transcribeAudio,
  ) as LiveGateway;
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
    chat,
    end,
    transcribeAudio,
    socketEmit,
    serverEmit,
  };
}

const pcmPayload = {
  clientSegmentId: 'segment-audio-1',
  pcm16: Buffer.alloc(32_000),
  sampleRate: 16_000,
  durationMs: 1_000,
};

describe('LiveGateway generic identities', () => {
  it('accepts host PCM and broadcasts only the backend canonical final', async () => {
    const { gateway, socket, transcribeAudio, serverEmit, socketEmit } = setup(
      RoomParticipantRole.HOST,
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });
    const segment = {
      id: 'segment-1',
      sessionId: details.id,
      clientSegmentId: 'segment-audio-1',
      seq: 1,
      text: 'Comunicação acessível',
      cleaningStrategyVersion: 'pt-br-conservative-v1',
      createdAt: new Date(),
    };
    transcribeAudio.execute.mockResolvedValue({
      segment,
      created: true,
      replayed: false,
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 42,
    });

    await expect(
      gateway.onTranscriptionAudio(socket as never, pcmPayload),
    ).resolves.toEqual({
      ok: true,
      seq: 1,
      replayed: false,
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 42,
    });
    expect(transcribeAudio.execute).toHaveBeenCalledWith(
      'account-1',
      details.id,
      expect.objectContaining({
        clientSegmentId: 'segment-audio-1',
        sampleRate: 16_000,
      }),
    );
    expect(serverEmit).toHaveBeenCalledWith(
      'transcript:final',
      expect.objectContaining({
        seq: 1,
        text: 'Comunicação acessível',
        cleaningStrategyVersion: 'pt-br-conservative-v1',
      }),
    );
    expect(socketEmit).toHaveBeenCalledWith(
      'transcription:status',
      expect.objectContaining({
        clientSegmentId: 'segment-audio-1',
        state: 'processing',
      }),
    );
  });

  it('includes the cleaning strategy in transcript replay state', async () => {
    const { gateway, socket, snapshot, socketEmit } = setup(
      RoomParticipantRole.HOST,
    );
    snapshot.execute.mockResolvedValueOnce({
      session: details,
      role: RoomParticipantRole.HOST,
      canManage: true,
      chat: [],
      transcript: [
        {
          id: 'segment-1',
          sessionId: details.id,
          clientSegmentId: 'segment-audio-1',
          seq: 1,
          text: 'Comunicação acessível',
          cleaningStrategyVersion: 'pt-br-conservative-v1',
          createdAt: new Date('2026-08-06T12:00:00Z'),
        },
      ],
    });

    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    expect(socketEmit).toHaveBeenCalledWith(
      'session:state',
      expect.objectContaining({
        transcript: [
          expect.objectContaining({
            seq: 1,
            text: 'Comunicação acessível',
            cleaningStrategyVersion: 'pt-br-conservative-v1',
          }),
        ],
      }),
    );
  });

  it('acknowledges no-speech without broadcasting an empty transcript', async () => {
    const { gateway, socket, transcribeAudio, serverEmit } = setup(
      RoomParticipantRole.HOST,
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });
    transcribeAudio.execute.mockResolvedValue({
      segment: null,
      created: false,
      replayed: false,
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 21,
    });

    await expect(
      gateway.onTranscriptionAudio(socket as never, pcmPayload),
    ).resolves.toMatchObject({ ok: true, seq: null });
    expect(serverEmit).not.toHaveBeenCalledWith(
      'transcript:final',
      expect.anything(),
    );
  });

  it('rejects moderator audio before invoking backend ASR', async () => {
    const { gateway, socket, transcribeAudio } = setup(
      RoomParticipantRole.MODERATOR,
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    await expect(
      gateway.onTranscriptionAudio(socket as never, pcmPayload),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the host can publish the transcript',
      },
    });
    expect(transcribeAudio.execute).not.toHaveBeenCalled();
  });

  it('does not expose Socket.IO handlers for client-provided transcript text', () => {
    const { gateway } = setup(RoomParticipantRole.HOST);
    expect(gateway).not.toHaveProperty('onTranscriptPartial');
    expect(gateway).not.toHaveProperty('onTranscriptFinal');
  });

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
    await gateway.onSessionJoin(socket, { sessionId: details.id });
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

  it('never lets a guest publish audio for canonical transcription', async () => {
    const { gateway, socket, transcribeAudio } = setup(
      RoomParticipantRole.GUEST,
      'guest',
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    await expect(
      gateway.onTranscriptionAudio(socket as never, pcmPayload),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the host can publish the transcript',
      },
    });
    expect(transcribeAudio.execute).not.toHaveBeenCalled();
  });
});

describe('LiveGateway participant removal', () => {
  function makeTargetSocket(participantId = 'participant-1') {
    const emit = jest.fn();
    const disconnect = jest.fn();
    const socket = {
      id: `socket-${participantId}`,
      data: {
        identity: {
          participantId,
          name: 'Participante',
          role: RoomParticipantRole.PARTICIPANT,
          kind: 'account' as const,
        },
        sessionId: details.id,
      },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit,
      to: jest.fn(() => ({ emit: jest.fn() })),
      disconnect,
    };
    return { socket, emit, disconnect };
  }

  function setupRemoval() {
    const base = setup(RoomParticipantRole.HOST);
    const { gateway } = base;
    const { socket: target, emit: targetEmit, disconnect: targetDisconnect } = makeTargetSocket();

    const state: LiveRoomStateService = (gateway as any).state;
    state.join(details.id, target.data.identity as any, target.id, { status: details.status });

    const roomSet = new Set([base.socket.id, target.id]);
    const socketsMap = new Map<string, unknown>([
      [base.socket.id, base.socket],
      [target.id, target],
    ]);
    (gateway as any).server = {
      to: jest.fn(() => ({ emit: base.serverEmit })),
      in: jest.fn(() => ({ socketsLeave: jest.fn() })),
      sockets: {
        adapter: { rooms: new Map([[`session:${details.id}`, roomSet]]) },
        sockets: socketsMap,
      },
    };
    return { ...base, target, targetEmit, targetDisconnect, state };
  }

  it('remove host can kick a participant and emits participant:removed before disconnecting', async () => {
    const { gateway, socket, targetEmit, targetDisconnect } = setupRemoval();
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    const result = gateway.onParticipantRemove(socket as never, {
      participantId: 'participant-1',
    });
    expect(result).toEqual({ ok: true });
    expect(targetEmit).toHaveBeenCalledWith(
      'participant:removed',
      expect.objectContaining({ reason: expect.any(String) }),
    );
    expect(targetDisconnect).toHaveBeenCalledWith(true);
  });

  it('blocks removed participant from rejoining when requiresApproval is false', async () => {
    const { gateway, socket, snapshot } = setupRemoval();
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });
    gateway.onParticipantRemove(socket as never, { participantId: 'participant-1' });

    const rejoinSocket = {
      id: 'socket-rejoin',
      data: { identity: { participantId: 'participant-1', name: 'Participante', role: RoomParticipantRole.PARTICIPANT, kind: 'account' as const } },
      join: jest.fn(), leave: jest.fn(), emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })), disconnect: jest.fn(),
    };
    snapshot.execute.mockResolvedValueOnce({
      session: details,
      role: RoomParticipantRole.PARTICIPANT,
      canManage: false,
      chat: [],
      transcript: [],
    });

    const result = await gateway.onSessionJoin(rejoinSocket as never, { sessionId: details.id });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'PARTICIPANT_REMOVED' }) });
  });

  it('routes removed participant to admission queue when requiresApproval is true', async () => {
    const { gateway, socket, snapshot } = setupRemoval();
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });
    gateway.onParticipantRemove(socket as never, { participantId: 'participant-1' });

    const detailsWithApproval = { ...details, requiresApproval: true };
    const rejoinSocket = {
      id: 'socket-rejoin',
      data: { identity: { participantId: 'participant-1', name: 'Participante', role: RoomParticipantRole.PARTICIPANT, kind: 'account' as const } },
      join: jest.fn(), leave: jest.fn(), emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })), disconnect: jest.fn(),
    };
    snapshot.execute.mockResolvedValueOnce({
      session: detailsWithApproval,
      role: RoomParticipantRole.PARTICIPANT,
      canManage: false,
      chat: [],
      transcript: [],
    });

    const result = await gateway.onSessionJoin(rejoinSocket as never, { sessionId: details.id });
    expect(result).toEqual({ ok: true });
    expect(rejoinSocket.emit).toHaveBeenCalledWith('admission:waiting', expect.anything());
  });

  it('refuses to remove the host', async () => {
    const { gateway, socket } = setupRemoval();
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    const result = gateway.onParticipantRemove(socket as never, {
      participantId: 'account-1',
    });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'FORBIDDEN' }) });
  });

  it('non-manager cannot remove participants', async () => {
    const base = setup(RoomParticipantRole.PARTICIPANT);
    await base.gateway.onSessionJoin(base.socket as never, { sessionId: details.id });

    const result = base.gateway.onParticipantRemove(base.socket as never, {
      participantId: 'some-other-participant',
    });
    expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'FORBIDDEN' }) });
  });
});
