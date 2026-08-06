import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { RoomRepository } from '../../rooms/repositories/room.repository';
import { SessionStatus } from '../../sessions/entities/live-session.entity';
import { TranscriptSegment } from '../../sessions/entities/transcript-segment.entity';
import { RoomSessionRepository } from '../../sessions/repositories/live-session.repository';
import { TranscriptRepository } from '../../sessions/repositories/transcript.repository';
import { AppendTranscriptSegmentUseCase } from '../../sessions/usecases/append-transcript-segment.usecase';
import { AsrClient } from '../asr-client';
import { AudioSegmentInput } from '../audio-segment';
import { SessionTranscriptionCoordinator } from '../session-transcription-coordinator';

export interface TranscribedAudioSegment {
  segment: TranscriptSegment | null;
  created: boolean;
  replayed: boolean;
  engine: string | null;
  model: string | null;
  inferenceMs: number | null;
}

const NO_SPEECH_REPLAY_TTL_MS = 120_000;

type NoSpeechReplay = Pick<
  TranscribedAudioSegment,
  'engine' | 'model' | 'inferenceMs'
> & { expiresAt: number };

@Injectable()
export class TranscribeAudioSegmentUseCase {
  private readonly noSpeechReplays = new Map<string, NoSpeechReplay>();
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly rooms: RoomRepository,
    private readonly permissions: RoomPermissionService,
    private readonly transcripts: TranscriptRepository,
    private readonly asr: AsrClient,
    private readonly coordinator: SessionTranscriptionCoordinator,
    private readonly appendTranscript: AppendTranscriptSegmentUseCase,
  ) {}

  async execute(
    actorUserId: string,
    sessionId: string,
    audio: AudioSegmentInput,
  ): Promise<TranscribedAudioSegment> {
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

    const noSpeechReplay = this.getNoSpeechReplay(
      sessionId,
      audio.clientSegmentId,
    );
    if (noSpeechReplay) return noSpeechReplay;

    const replay = await this.transcripts.findByClientSegmentId(
      sessionId,
      audio.clientSegmentId,
    );
    if (replay) return this.replayed(replay);

    return this.coordinator.enqueue(
      sessionId,
      audio.clientSegmentId,
      async () => {
        const existing = await this.transcripts.findByClientSegmentId(
          sessionId,
          audio.clientSegmentId,
        );
        if (existing) return this.replayed(existing);

        const result = await this.asr.transcribe({
          requestId: audio.clientSegmentId,
          pcm16: audio.pcm16,
          sampleRate: audio.sampleRate,
          durationMs: audio.durationMs,
          language: audio.language,
        });
        const normalizedText = result.text.trim();
        if (!normalizedText) {
          this.rememberNoSpeech(sessionId, audio.clientSegmentId, result);
          return {
            segment: null,
            created: false,
            replayed: false,
            engine: result.engine,
            model: result.model,
            inferenceMs: result.inferenceMs,
          };
        }
        const appended = await this.appendTranscript.execute(
          actorUserId,
          sessionId,
          normalizedText,
          audio.clientSegmentId,
        );
        if (!appended) {
          this.rememberNoSpeech(sessionId, audio.clientSegmentId, result);
        }
        return {
          segment: appended?.segment ?? null,
          created: appended?.created ?? false,
          replayed: appended ? !appended.created : false,
          engine: result.engine,
          model: result.model,
          inferenceMs: result.inferenceMs,
        };
      },
    );
  }

  private getNoSpeechReplay(
    sessionId: string,
    clientSegmentId: string,
  ): TranscribedAudioSegment | null {
    const now = Date.now();
    for (const [key, value] of this.noSpeechReplays) {
      if (value.expiresAt <= now) this.noSpeechReplays.delete(key);
    }
    const replay = this.noSpeechReplays.get(`${sessionId}:${clientSegmentId}`);
    if (!replay) return null;
    return {
      segment: null,
      created: false,
      replayed: true,
      engine: replay.engine,
      model: replay.model,
      inferenceMs: replay.inferenceMs,
    };
  }

  private rememberNoSpeech(
    sessionId: string,
    clientSegmentId: string,
    result: Pick<TranscribedAudioSegment, 'engine' | 'model' | 'inferenceMs'>,
  ): void {
    this.noSpeechReplays.set(`${sessionId}:${clientSegmentId}`, {
      ...result,
      expiresAt: Date.now() + NO_SPEECH_REPLAY_TTL_MS,
    });
  }

  private replayed(segment: TranscriptSegment): TranscribedAudioSegment {
    return {
      segment,
      created: false,
      replayed: true,
      engine: null,
      model: null,
      inferenceMs: null,
    };
  }
}
