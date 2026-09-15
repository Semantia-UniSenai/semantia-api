import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { SessionStatus } from '../../sessions/entities/live-session.entity';
import { RoomSessionRepository } from '../../sessions/repositories/live-session.repository';
import {
  MediaRoomProvider,
  type IssueMediaCredentialsInput,
} from '../contracts/media-room.provider';
import { MediaError } from '../errors/media.errors';
import { IssueMediaCredentialsUseCase } from './issue-media-credentials.usecase';

function input(): IssueMediaCredentialsInput {
  return {
    sessionId: 'session-1',
    participant: {
      participantId: 'participant-1',
      name: 'Lia',
      role: RoomParticipantRole.PARTICIPANT,
    },
  };
}

describe('IssueMediaCredentialsUseCase', () => {
  const liveSession = { id: 'session-1', status: SessionStatus.LIVE };

  function setup(status: SessionStatus = SessionStatus.LIVE) {
    const provider = {
      issueCredentials: jest.fn(),
      closeRoom: jest.fn().mockResolvedValue(undefined),
    } as unknown as MediaRoomProvider;
    const sessions = {
      findById: jest.fn().mockResolvedValue({ ...liveSession, status }),
    } as unknown as RoomSessionRepository;
    const useCase = new IssueMediaCredentialsUseCase(provider, sessions);
    return { provider, sessions, useCase };
  }

  it('rejects credentials when the canonical session is not live', async () => {
    const { provider, useCase } = setup(SessionStatus.ENDED);

    await expect(useCase.execute(input())).rejects.toEqual(
      expect.objectContaining<Partial<MediaError>>({
        code: 'SESSION_READ_ONLY',
      }),
    );
    expect(provider.issueCredentials).not.toHaveBeenCalled();
  });

  it.each([
    ['sessionId', { sessionId: '   ' }],
    [
      'participantId',
      { participant: { ...input().participant, participantId: '   ' } },
    ],
    ['name', { participant: { ...input().participant, name: '   ' } }],
  ])(
    'rejects an empty %s before calling the provider',
    async (_field, override) => {
      const { provider, useCase } = setup();
      const request = { ...input(), ...override };

      await expect(useCase.execute(request)).rejects.toEqual(
        expect.objectContaining<Partial<MediaError>>({ code: 'BAD_REQUEST' }),
      );
      expect(provider.issueCredentials).not.toHaveBeenCalled();
    },
  );

  it('delegates a live admitted participant without changing identity', async () => {
    const credentials = {
      serverUrl: 'wss://media.example.test',
      participantToken: 'short-lived-token',
      expiresInSeconds: 600 as const,
    };
    const { provider, useCase } = setup();
    jest.mocked(provider.issueCredentials).mockResolvedValue(credentials);
    const request = input();

    await expect(useCase.execute(request)).resolves.toEqual(credentials);
    expect(provider.issueCredentials).toHaveBeenCalledWith(request);
  });

  it('discards credentials and closes media when the session ends during issuance', async () => {
    const { provider, sessions, useCase } = setup();
    jest.mocked(provider.issueCredentials).mockResolvedValue({
      serverUrl: 'wss://media.example.test',
      participantToken: 'must-not-be-returned',
      expiresInSeconds: 60,
    });
    jest
      .mocked(sessions.findById)
      .mockResolvedValueOnce({
        ...liveSession,
        status: SessionStatus.LIVE,
      } as never)
      .mockResolvedValueOnce({
        ...liveSession,
        status: SessionStatus.ENDED,
      } as never);

    await expect(useCase.execute(input())).rejects.toEqual(
      expect.objectContaining<Partial<MediaError>>({
        code: 'SESSION_READ_ONLY',
      }),
    );
    expect(provider.closeRoom).toHaveBeenCalledWith('session-1');
  });
});
