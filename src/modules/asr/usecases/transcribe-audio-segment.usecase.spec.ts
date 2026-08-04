import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { TranscriptSegment } from '../../sessions/entities/transcript-segment.entity';
import {
  buildRoomRepo,
  buildSession,
  buildSessionRepo,
  buildTranscriptRepo,
} from '../../sessions/testing/session-test.helpers';
import { SessionStatus } from '../../sessions/entities/live-session.entity';
import { AsrClient } from '../asr-client';
import { AudioSegmentInput } from '../audio-segment';
import { SessionTranscriptionCoordinator } from '../session-transcription-coordinator';
import { TranscribeAudioSegmentUseCase } from './transcribe-audio-segment.usecase';

const audio: AudioSegmentInput = {
  clientSegmentId: 'segment-0001',
  pcm16: Buffer.alloc(32_000),
  sampleRate: 16_000,
  durationMs: 1_000,
  language: 'pt',
};

function setup(status = SessionStatus.LIVE, role = RoomParticipantRole.HOST) {
  const sessions = buildSessionRepo();
  const rooms = buildRoomRepo();
  const transcripts = buildTranscriptRepo();
  sessions.findById.mockResolvedValue(buildSession({ status }));
  rooms.getParticipantRole.mockResolvedValue(role);
  const asr = {
    transcribe: jest.fn().mockResolvedValue({
      text: 'Comunicação acessível',
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 42,
    }),
  } as jest.Mocked<AsrClient>;
  const append = { execute: jest.fn() };
  const useCase = new TranscribeAudioSegmentUseCase(
    sessions,
    rooms,
    new RoomPermissionService(),
    transcripts,
    asr,
    new SessionTranscriptionCoordinator(),
    append as never,
  );
  return { useCase, sessions, rooms, transcripts, asr, append };
}

describe('TranscribeAudioSegmentUseCase', () => {
  it('returns a persisted replay without invoking ASR again', async () => {
    const { useCase, transcripts, asr, append } = setup();
    const existing = new TranscriptSegment({
      id: 'transcript-1',
      sessionId: 'session-1',
      clientSegmentId: audio.clientSegmentId,
      seq: 4,
      text: 'Comunicação acessível',
      createdAt: new Date(),
    });
    transcripts.findByClientSegmentId.mockResolvedValue(existing);

    await expect(
      useCase.execute('host-1', 'session-1', audio),
    ).resolves.toEqual({
      segment: existing,
      created: false,
      replayed: true,
      engine: null,
      model: null,
      inferenceMs: null,
    });
    expect(asr.transcribe).not.toHaveBeenCalled();
    expect(append.execute).not.toHaveBeenCalled();
  });

  it('transcribes and appends exactly one canonical final', async () => {
    const { useCase, transcripts, asr, append } = setup();
    const segment = new TranscriptSegment({
      id: 'transcript-1',
      sessionId: 'session-1',
      clientSegmentId: audio.clientSegmentId,
      seq: 1,
      text: 'Comunicação acessível',
      createdAt: new Date(),
    });
    transcripts.findByClientSegmentId.mockResolvedValue(null);
    append.execute.mockResolvedValue({ segment, created: true });

    await expect(
      useCase.execute('host-1', 'session-1', audio),
    ).resolves.toEqual({
      segment,
      created: true,
      replayed: false,
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 42,
    });
    expect(asr.transcribe).toHaveBeenCalledWith({
      requestId: audio.clientSegmentId,
      pcm16: audio.pcm16,
      sampleRate: 16_000,
      durationMs: 1_000,
      language: 'pt',
    });
    expect(append.execute).toHaveBeenCalledWith(
      'host-1',
      'session-1',
      'Comunicação acessível',
      audio.clientSegmentId,
    );
  });

  it('rejects a non-host before audio reaches the ASR client', async () => {
    const { useCase, asr } = setup(
      SessionStatus.LIVE,
      RoomParticipantRole.MODERATOR,
    );

    await expect(
      useCase.execute('moderator-1', 'session-1', audio),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(asr.transcribe).not.toHaveBeenCalled();
  });

  it('rejects an ended session before audio reaches the ASR client', async () => {
    const { useCase, asr } = setup(SessionStatus.ENDED);

    await expect(
      useCase.execute('host-1', 'session-1', audio),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(asr.transcribe).not.toHaveBeenCalled();
  });
});
