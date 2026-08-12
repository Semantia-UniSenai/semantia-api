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
      cleaningStrategyVersion: 'pt-br-conservative-v1',
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
      cleaningStrategyVersion: 'pt-br-conservative-v1',
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

  it('treats an empty ASR result as successful no-speech without persistence', async () => {
    const { useCase, transcripts, asr, append } = setup();
    transcripts.findByClientSegmentId.mockResolvedValue(null);
    asr.transcribe.mockResolvedValue({
      text: '',
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 21,
    });

    const first = await useCase.execute('host-1', 'session-1', audio);
    const replay = await useCase.execute('host-1', 'session-1', audio);

    expect(first).toEqual({
      segment: null,
      created: false,
      replayed: false,
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 21,
    });
    expect(replay).toEqual({
      segment: null,
      created: false,
      replayed: true,
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 21,
    });
    expect(asr.transcribe).toHaveBeenCalledTimes(1);
    expect(append.execute).not.toHaveBeenCalled();
  });

  it('caches text discarded by canonical cleaning without re-invoking ASR', async () => {
    const { useCase, transcripts, asr, append } = setup();
    transcripts.findByClientSegmentId.mockResolvedValue(null);
    asr.transcribe.mockResolvedValue({
      text: 'né? né?',
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 23,
    });
    append.execute.mockResolvedValue(null);

    const first = await useCase.execute('host-1', 'session-1', audio);
    const replay = await useCase.execute('host-1', 'session-1', audio);

    expect(first).toEqual({
      segment: null,
      created: false,
      replayed: false,
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 23,
    });
    expect(replay).toEqual({ ...first, replayed: true });
    expect(asr.transcribe).toHaveBeenCalledTimes(1);
    expect(append.execute).toHaveBeenCalledTimes(1);
  });

  it('bounds the ephemeral no-speech replay cache by cardinality', async () => {
    const { useCase, transcripts, asr } = setup();
    transcripts.findByClientSegmentId.mockResolvedValue(null);
    asr.transcribe.mockResolvedValue({
      text: '',
      engine: 'faster-whisper',
      model: 'small',
      inferenceMs: 21,
    });
    const cacheLimit = 512;

    for (let index = 0; index <= cacheLimit; index += 1) {
      await useCase.execute('host-1', 'session-1', {
        ...audio,
        clientSegmentId: `segment-${index.toString().padStart(4, '0')}`,
      });
    }
    expect(asr.transcribe).toHaveBeenCalledTimes(cacheLimit + 1);

    await useCase.execute('host-1', 'session-1', {
      ...audio,
      clientSegmentId: 'segment-0000',
    });
    expect(asr.transcribe).toHaveBeenCalledTimes(cacheLimit + 2);

    await useCase.execute('host-1', 'session-1', {
      ...audio,
      clientSegmentId: `segment-${cacheLimit.toString().padStart(4, '0')}`,
    });
    expect(asr.transcribe).toHaveBeenCalledTimes(cacheLimit + 2);
  });

  it('expires the ephemeral no-speech replay cache', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const { useCase, transcripts, asr, append } = setup();
      transcripts.findByClientSegmentId.mockResolvedValue(null);
      asr.transcribe.mockResolvedValue({
        text: '',
        engine: 'faster-whisper',
        model: 'small',
        inferenceMs: 21,
      });

      await useCase.execute('host-1', 'session-1', audio);
      now.mockReturnValue(121_001);
      await useCase.execute('host-1', 'session-1', audio);

      expect(asr.transcribe).toHaveBeenCalledTimes(2);
      expect(append.execute).not.toHaveBeenCalled();
    } finally {
      now.mockRestore();
    }
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
