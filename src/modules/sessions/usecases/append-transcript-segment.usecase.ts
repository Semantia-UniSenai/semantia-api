import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { AudienceContextSnapshot } from '../entities/audience-context.entity';
import { SessionStatus } from '../entities/live-session.entity';
import { RoomSessionRepository } from '../repositories/live-session.repository';
import {
  AppendTranscriptResult,
  TranscriptRepository,
} from '../repositories/transcript.repository';
import { cleanCanonicalTranscript } from './disfluencies';

export const MAX_TRANSCRIPT_SEGMENT_LENGTH = 5000;
const CLIENT_SEGMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;

export interface AppendCanonicalTranscriptResult extends AppendTranscriptResult {
  adaptationContext: AudienceContextSnapshot;
}

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
    clientSegmentId?: string,
  ): Promise<AppendCanonicalTranscriptResult | null> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('Transcript text must not be empty');
    }
    if (trimmed.length > MAX_TRANSCRIPT_SEGMENT_LENGTH) {
      throw new BadRequestException('Transcript segment is too long');
    }
    const idempotencyKey = clientSegmentId?.trim() || randomUUID();
    if (!CLIENT_SEGMENT_ID_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Invalid clientSegmentId');
    }
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    const role = await this.rooms.getParticipantRole(
      session.roomId,
      actorUserId,
    );
    if (
      !this.permissions.canManage(role) ||
      role !== RoomParticipantRole.HOST
    ) {
      throw new ForbiddenException('Only the host can publish the transcript');
    }
    if (session.status !== SessionStatus.LIVE) {
      throw new ConflictException('Session is read-only');
    }
    const canonical = cleanCanonicalTranscript(trimmed);
    if (!canonical.text) return null;
    const appended = await this.transcripts.append(
      sessionId,
      canonical.text,
      idempotencyKey,
      canonical.cleaningStrategyVersion,
    );
    return {
      ...appended,
      adaptationContext: {
        context: session.audienceContext,
        contextVersion: session.audienceContextVersion,
      },
    };
  }
}
