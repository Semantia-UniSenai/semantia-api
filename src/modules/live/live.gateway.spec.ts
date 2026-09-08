import { RoomParticipantRole } from '../rooms/entities/room.entity';
import { MediaError } from '../media/errors/media.errors';
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
  const issueMediaCredentials = { execute: jest.fn() };
  const closeMediaRoom = { execute: jest.fn() };
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
    issueMediaCredentials,
    closeMediaRoom,
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
    issueMediaCredentials,
    closeMediaRoom,
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

describe('LiveGateway media credentials', () => {
  const credentials = {
    serverUrl: 'wss://media.example.test',
    participantToken: 'short-lived-token',
    expiresInSeconds: 600,
  };

  it.each([
    [RoomParticipantRole.HOST, 'account'],
    [RoomParticipantRole.PARTICIPANT, 'account'],
    [RoomParticipantRole.GUEST, 'guest'],
  ] as const)('issues credentials to an admitted %s', async (role, kind) => {
    const { gateway, socket, issueMediaCredentials } = setup(role, kind);
    issueMediaCredentials.execute.mockResolvedValue(credentials);
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    await expect((gateway as any).onMediaCredentials(socket)).resolves.toEqual({
      ok: true,
      ...credentials,
    });
    expect(issueMediaCredentials.execute).toHaveBeenCalledWith({
      sessionId: details.id,
      status: SessionStatus.LIVE,
      participant: {
        participantId: kind === 'guest' ? 'guest:1' : 'account-1',
        name: 'Pessoa',
        role,
      },
    });
  });

  it('rejects an unauthenticated socket', async () => {
    const { gateway, socket, issueMediaCredentials } = setup(
      RoomParticipantRole.PARTICIPANT,
    );
    socket.data.identity = undefined as never;

    await expect((gateway as any).onMediaCredentials(socket)).resolves.toEqual({
      ok: false,
      error: { code: 'UNAUTHORIZED', message: 'Socket is not authenticated' },
    });
    expect(issueMediaCredentials.execute).not.toHaveBeenCalled();
  });

  it('rejects an authenticated socket that has not passed admission', async () => {
    const { gateway, socket, issueMediaCredentials } = setup(
      RoomParticipantRole.PARTICIPANT,
    );

    await expect((gateway as any).onMediaCredentials(socket)).resolves.toEqual({
      ok: false,
      error: { code: 'NOT_JOINED', message: 'Join a session first' },
    });
    expect(issueMediaCredentials.execute).not.toHaveBeenCalled();
  });

  it('returns the canonical read-only error for an ended session', async () => {
    const { gateway, socket, snapshot, issueMediaCredentials } = setup(
      RoomParticipantRole.HOST,
    );
    snapshot.execute.mockResolvedValueOnce({
      session: { ...details, status: SessionStatus.ENDED },
      role: RoomParticipantRole.HOST,
      canManage: true,
      chat: [],
      transcript: [],
    });
    issueMediaCredentials.execute.mockRejectedValueOnce(
      new MediaError('SESSION_READ_ONLY', 'Session is read-only'),
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    await expect((gateway as any).onMediaCredentials(socket)).resolves.toEqual({
      ok: false,
      error: { code: 'SESSION_READ_ONLY', message: 'Session is read-only' },
    });
  });

  it('sanitizes a provider failure without broadcasting credentials', async () => {
    const { gateway, socket, issueMediaCredentials, serverEmit } = setup(
      RoomParticipantRole.HOST,
    );
    issueMediaCredentials.execute.mockRejectedValueOnce(
      new MediaError('MEDIA_UNAVAILABLE', 'Audio and video are unavailable', {
        cause: new Error('api-secret=must-not-leak'),
      }),
    );
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    await expect((gateway as any).onMediaCredentials(socket)).resolves.toEqual({
      ok: false,
      error: {
        code: 'MEDIA_UNAVAILABLE',
        message: 'Audio and video are unavailable',
      },
    });
    expect(serverEmit).not.toHaveBeenCalledWith(
      'media:credentials',
      expect.anything(),
    );
  });

  it('keeps media credentials out of session state', async () => {
    const { gateway, socket, socketEmit } = setup(RoomParticipantRole.HOST);

    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    const state = socketEmit.mock.calls.find(
      ([event]) => event === 'session:state',
    )?.[1];
    expect(state).toEqual(
      expect.not.objectContaining({
        serverUrl: expect.anything(),
        participantToken: expect.anything(),
      }),
    );
  });
});

describe('LiveGateway media cleanup', () => {
  it('closes provider media after the canonical session transition', async () => {
    const { gateway, socket, end, closeMediaRoom, serverEmit } = setup(
      RoomParticipantRole.HOST,
    );
    closeMediaRoom.execute.mockResolvedValue(undefined);
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    await expect(gateway.onSessionEnd(socket as never)).resolves.toEqual({
      ok: true,
    });
    expect(closeMediaRoom.execute).toHaveBeenCalledTimes(1);
    expect(closeMediaRoom.execute).toHaveBeenCalledWith(details.id);
    expect(end.execute.mock.invocationCallOrder[0]).toBeLessThan(
      closeMediaRoom.execute.mock.invocationCallOrder[0],
    );
    const endedBroadcast = serverEmit.mock.calls.find(
      ([event]) => event === 'session:ended',
    );
    expect(endedBroadcast).toBeDefined();
    expect(closeMediaRoom.execute.mock.invocationCallOrder[0]).toBeLessThan(
      serverEmit.mock.invocationCallOrder.at(-1)!,
    );
  });

  it('keeps the canonical end successful when provider cleanup fails', async () => {
    const { gateway, socket, closeMediaRoom, serverEmit } = setup(
      RoomParticipantRole.HOST,
    );
    const unsafeSessionId = 'session-1\nforged-log';
    const cleanupWarning = jest
      .spyOn((gateway as any).logger, 'warn')
      .mockImplementation(() => undefined);
    closeMediaRoom.execute.mockRejectedValueOnce(
      new MediaError(
        'MEDIA_CLEANUP_FAILED',
        'The media room could not be closed',
        { cause: new Error('api-secret=must-not-leak') },
      ),
    );
    await gateway.onSessionJoin(socket as never, {
      sessionId: unsafeSessionId,
    });

    const ack = await gateway.onSessionEnd(socket as never);

    expect(ack).toEqual({ ok: true });
    expect(closeMediaRoom.execute).toHaveBeenCalledWith(unsafeSessionId);
    expect(serverEmit).toHaveBeenCalledWith(
      'session:ended',
      expect.objectContaining({ sessionId: unsafeSessionId }),
    );
    expect(JSON.stringify({ ack, calls: serverEmit.mock.calls })).not.toContain(
      'must-not-leak',
    );
    expect(cleanupWarning).toHaveBeenCalledWith(
      'Media cleanup failed for session session-1_forged-log: MEDIA_CLEANUP_FAILED',
    );
    expect(JSON.stringify(cleanupWarning.mock.calls)).not.toContain(
      'must-not-leak',
    );
  });

  it('does not close media when the canonical end fails', async () => {
    const { gateway, socket, end, closeMediaRoom } = setup(
      RoomParticipantRole.HOST,
    );
    const unexpectedError = jest
      .spyOn((gateway as any).logger, 'error')
      .mockImplementation(() => undefined);
    end.execute.mockRejectedValueOnce(new Error('database unavailable'));
    await gateway.onSessionJoin(socket as never, { sessionId: details.id });

    await expect(gateway.onSessionEnd(socket as never)).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Unexpected error' },
    });
    expect(closeMediaRoom.execute).not.toHaveBeenCalled();
    expect(unexpectedError).toHaveBeenCalledWith(
      'Unexpected gateway error',
      expect.stringContaining('database unavailable'),
    );
  });
});
