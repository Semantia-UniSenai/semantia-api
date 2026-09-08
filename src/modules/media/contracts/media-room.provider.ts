import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { SessionStatus } from '../../sessions/entities/live-session.entity';

export interface MediaCredentials {
  serverUrl: string;
  participantToken: string;
  expiresInSeconds: number;
}

export interface IssueMediaCredentialsInput {
  sessionId: string;
  status: SessionStatus;
  participant: {
    participantId: string;
    name: string;
    role: RoomParticipantRole;
  };
}

export abstract class MediaRoomProvider {
  abstract issueCredentials(
    input: IssueMediaCredentialsInput,
  ): Promise<MediaCredentials>;

  abstract closeRoom(sessionId: string): Promise<void>;
}
