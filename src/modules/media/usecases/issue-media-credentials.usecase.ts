import { Injectable } from '@nestjs/common';
import { SessionStatus } from '../../sessions/entities/live-session.entity';
import { RoomSessionRepository } from '../../sessions/repositories/live-session.repository';
import {
  MediaRoomProvider,
  type IssueMediaCredentialsInput,
  type MediaCredentials,
} from '../contracts/media-room.provider';
import { MediaError } from '../errors/media.errors';

@Injectable()
export class IssueMediaCredentialsUseCase {
  constructor(
    private readonly mediaRoom: MediaRoomProvider,
    private readonly sessions: RoomSessionRepository,
  ) {}

  async execute(input: IssueMediaCredentialsInput): Promise<MediaCredentials> {
    if (
      !input.sessionId.trim() ||
      !input.participant.participantId.trim() ||
      !input.participant.name.trim()
    ) {
      throw new MediaError('BAD_REQUEST', 'Media identity is incomplete');
    }
    const session = await this.sessions.findById(input.sessionId);
    if (!session || session.status !== SessionStatus.LIVE) {
      throw new MediaError('SESSION_READ_ONLY', 'Session is read-only');
    }
    const credentials = await this.mediaRoom.issueCredentials(input);
    const canonicalSession = await this.sessions.findById(input.sessionId);
    if (!canonicalSession || canonicalSession.status !== SessionStatus.LIVE) {
      try {
        await this.mediaRoom.closeRoom(input.sessionId);
      } catch {
        // Never expose credentials or provider details after canonical end.
      }
      throw new MediaError('SESSION_READ_ONLY', 'Session is read-only');
    }
    return credentials;
  }
}
