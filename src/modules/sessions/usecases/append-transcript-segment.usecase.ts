import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { SessionStatus } from '../entities/live-session.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';
import { TranscriptRepository } from '../repositories/transcript.repository';
import { stripDisfluencies } from './disfluencies';

export const MAX_TRANSCRIPT_SEGMENT_LENGTH = 5000;

@Injectable()
export class AppendTranscriptSegmentUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
    private readonly transcripts: TranscriptRepository,
  ) {}

  async execute(
    actorUserId: string,
    sessionId: string,
    text: string,
  ): Promise<TranscriptSegment | null> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('Transcript text must not be empty');
    }
    if (trimmed.length > MAX_TRANSCRIPT_SEGMENT_LENGTH) {
      throw new BadRequestException('Transcript segment is too long');
    }
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    const role = await this.rooms.getParticipantRole(
      session.roomId,
      actorUserId,
    );
    if (!this.permissions.canManage(role)) {
      throw new ForbiddenException(
        'Only a host or moderator can publish the transcript',
      );
    }
    if (session.status !== SessionStatus.LIVE) {
      throw new ConflictException('Session is read-only');
    }
    const clean = stripDisfluencies(trimmed);
    return clean ? this.transcripts.append(sessionId, clean) : null;
  }
}
