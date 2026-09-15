import { ConfigService } from '@nestjs/config';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { SessionStatus } from '../../sessions/entities/live-session.entity';
import { MediaError } from '../errors/media.errors';
import { LiveKitMediaRoomProvider } from './livekit-media-room.provider';

jest.mock('livekit-server-sdk', () => {
  const addGrant = jest.fn();
  const toJwt = jest.fn();
  const createRoom = jest.fn();
  const deleteRoom = jest.fn();
  const accessToken = jest.fn().mockImplementation(() => ({
    addGrant,
    toJwt,
  }));
  const liveKitApi = jest.fn().mockImplementation(() => ({
    room: { createRoom, deleteRoom },
  }));
  return {
    AccessToken: accessToken,
    LiveKitAPI: liveKitApi,
    TrackSource: { MICROPHONE: 'microphone', CAMERA: 'camera' },
    __mocks: {
      addGrant,
      toJwt,
      createRoom,
      deleteRoom,
      accessToken,
      liveKitApi,
    },
  };
});

const sdkMocks = jest.requireMock<{
  __mocks: {
    addGrant: jest.Mock;
    toJwt: jest.Mock;
    createRoom: jest.Mock;
    deleteRoom: jest.Mock;
    accessToken: jest.Mock;
    liveKitApi: jest.Mock;
  };
}>('livekit-server-sdk').__mocks;
const mockAddGrant = sdkMocks.addGrant;
const mockToJwt = sdkMocks.toJwt;
const mockCreateRoom = sdkMocks.createRoom;
const mockDeleteRoom = sdkMocks.deleteRoom;
const mockAccessToken = sdkMocks.accessToken;

const configuredValues: Record<string, string> = {
  LIVEKIT_URL: 'wss://media.example.test',
  LIVEKIT_API_KEY: 'api-key',
  LIVEKIT_API_SECRET: 'api-secret',
  LIVEKIT_TOKEN_TTL_SECONDS: '600',
  LIVEKIT_REQUEST_TIMEOUT_SECONDS: '3',
};

function config(
  values: Record<string, string> = configuredValues,
): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

const request = {
  sessionId: 'session-1',
  status: SessionStatus.LIVE,
  participant: {
    participantId: 'participant-1',
    name: 'Lia',
    role: RoomParticipantRole.PARTICIPANT,
  },
};

describe('LiveKitMediaRoomProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRoom.mockResolvedValue({ name: 'semantia:session-1' });
    mockDeleteRoom.mockResolvedValue(undefined);
    mockToJwt.mockResolvedValue('signed-participant-token');
  });

  it('creates a bounded room and issues a camera/microphone-only token', async () => {
    const provider = new LiveKitMediaRoomProvider(config());

    await expect(provider.issueCredentials(request)).resolves.toEqual({
      serverUrl: 'wss://media.example.test',
      participantToken: 'signed-participant-token',
      expiresInSeconds: 600,
    });
    expect(mockCreateRoom).toHaveBeenCalledWith({
      name: 'semantia:session-1',
      maxParticipants: 50,
      emptyTimeout: 60,
    });
    expect(sdkMocks.liveKitApi).toHaveBeenCalledWith({
      host: 'wss://media.example.test',
      apiKey: 'api-key',
      secret: 'api-secret',
      requestTimeout: 3,
    });
    expect(mockAccessToken).toHaveBeenCalledWith('api-key', 'api-secret', {
      identity: 'participant-1',
      name: 'Lia',
      metadata: JSON.stringify({ role: RoomParticipantRole.PARTICIPANT }),
      ttl: 600,
    });
    expect(mockAddGrant).toHaveBeenCalledWith({
      room: 'semantia:session-1',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ['microphone', 'camera'],
    });
  });

  it('caps an unsafe configured token TTL', async () => {
    const provider = new LiveKitMediaRoomProvider(
      config({ ...configuredValues, LIVEKIT_TOKEN_TTL_SECONDS: '3600' }),
    );

    await expect(provider.issueCredentials(request)).resolves.toMatchObject({
      expiresInSeconds: 600,
    });
    expect(mockAccessToken).toHaveBeenCalledWith(
      'api-key',
      'api-secret',
      expect.objectContaining({ ttl: 600 }),
    );
  });

  it('treats an existing room as a concurrent idempotent create', async () => {
    mockCreateRoom.mockRejectedValueOnce({
      code: 6,
      message: 'already exists',
    });
    const provider = new LiveKitMediaRoomProvider(config());

    await expect(provider.issueCredentials(request)).resolves.toEqual({
      serverUrl: 'wss://media.example.test',
      participantToken: 'signed-participant-token',
      expiresInSeconds: 600,
    });
    expect(mockAccessToken).toHaveBeenCalledTimes(1);
  });

  it('fails closed when provider credentials are absent', async () => {
    const provider = new LiveKitMediaRoomProvider(config({}));

    await expect(provider.issueCredentials(request)).rejects.toEqual(
      expect.objectContaining<Partial<MediaError>>({
        code: 'MEDIA_UNAVAILABLE',
      }),
    );
    expect(mockAccessToken).not.toHaveBeenCalled();
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });

  it('deletes the canonical provider room on cleanup', async () => {
    const provider = new LiveKitMediaRoomProvider(config());

    await expect(provider.closeRoom('session-1')).resolves.toBeUndefined();
    expect(mockDeleteRoom).toHaveBeenCalledWith('semantia:session-1');
  });

  it('treats provider room absence as idempotent cleanup', async () => {
    mockDeleteRoom.mockRejectedValueOnce({ code: 5, message: 'not found' });
    const provider = new LiveKitMediaRoomProvider(config());

    await expect(provider.closeRoom('session-1')).resolves.toBeUndefined();
  });
});
