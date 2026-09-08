import { Injectable } from '@nestjs/common';
import { SessionStatus } from '../../sessions/entities/live-session.entity';
import {
  MediaRoomProvider,
  type IssueMediaCredentialsInput,
  type MediaCredentials,
} from '../contracts/media-room.provider';
import { MediaError } from '../errors/media.errors';

@Injectable()
export class IssueMediaCredentialsUseCase {
  constructor(private readonly mediaRoom: MediaRoomProvider) {}

  async execute(input: IssueMediaCredentialsInput): Promise<MediaCredentials> {
    if (
      !input.sessionId.trim() ||
      !input.participant.participantId.trim() ||
      !input.participant.name.trim()
    ) {
      throw new MediaError('BAD_REQUEST', 'Media identity is incomplete');
    }
    if (input.status !== SessionStatus.LIVE) {
      throw new MediaError('SESSION_READ_ONLY', 'Session is read-only');
    }
    return this.mediaRoom.issueCredentials(input);
  }
}
