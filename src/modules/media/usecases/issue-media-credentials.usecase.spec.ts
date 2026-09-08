import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { SessionStatus } from '../../sessions/entities/live-session.entity';
import {
  MediaRoomProvider,
  type IssueMediaCredentialsInput,
} from '../contracts/media-room.provider';
import { MediaError } from '../errors/media.errors';
import { IssueMediaCredentialsUseCase } from './issue-media-credentials.usecase';

function input(
  status: SessionStatus = SessionStatus.LIVE,
): IssueMediaCredentialsInput {
  return {
    sessionId: 'session-1',
    status,
    participant: {
      participantId: 'participant-1',
      name: 'Lia',
      role: RoomParticipantRole.PARTICIPANT,
    },
  };
}

describe('IssueMediaCredentialsUseCase', () => {
  it('rejects credentials when the canonical session is not live', async () => {
    const provider = {
      issueCredentials: jest.fn(),
      closeRoom: jest.fn(),
    } as unknown as MediaRoomProvider;
    const useCase = new IssueMediaCredentialsUseCase(provider);

    await expect(useCase.execute(input(SessionStatus.ENDED))).rejects.toEqual(
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
      const provider = {
        issueCredentials: jest.fn(),
        closeRoom: jest.fn(),
      } as unknown as MediaRoomProvider;
      const useCase = new IssueMediaCredentialsUseCase(provider);
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
    const provider = {
      issueCredentials: jest.fn().mockResolvedValue(credentials),
      closeRoom: jest.fn(),
    } as unknown as MediaRoomProvider;
    const useCase = new IssueMediaCredentialsUseCase(provider);
    const request = input();

    await expect(useCase.execute(request)).resolves.toEqual(credentials);
    expect(provider.issueCredentials).toHaveBeenCalledWith(request);
  });
});
