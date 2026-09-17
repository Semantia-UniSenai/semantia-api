import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { SessionStatus } from '../entities/live-session.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import {
  buildRoomRepo,
  buildSession,
  buildSessionRepo,
  buildTranscriptRepo,
} from '../testing/session-test.helpers';
import { AppendTranscriptSegmentUseCase } from './append-transcript-segment.usecase';

describe('AppendTranscriptSegmentUseCase canonical persistence', () => {
  it('persists only canonical text and its strategy version in the same append', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const transcripts = buildTranscriptRepo();
    const useCase = new AppendTranscriptSegmentUseCase(
      sessions,
      rooms,
      new RoomPermissionService(),
      transcripts,
    );
    const segment = new TranscriptSegment({
      id: 'transcript-1',
      sessionId: 'session-1',
      clientSegmentId: 'segment-0001',
      seq: 1,
      text: 'hoje aula',
      cleaningStrategyVersion: 'pt-br-conservative-v1',
      createdAt: new Date('2026-08-06T12:00:00Z'),
    });
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.LIVE }),
    );
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);
    transcripts.append.mockResolvedValue({ segment, created: true });

    await expect(
      useCase.execute(
        'host-1',
        'session-1',
        'né? hoje hoje aula',
        'segment-0001',
      ),
    ).resolves.toEqual({
      segment,
      created: true,
      adaptationContext: { context: null, contextVersion: 0 },
    });
    expect(transcripts.append).toHaveBeenCalledWith(
      'session-1',
      'hoje aula',
      'segment-0001',
      'pt-br-conservative-v1',
    );
  });

  it('does not persist when canonical cleaning removes the whole segment', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const transcripts = buildTranscriptRepo();
    const useCase = new AppendTranscriptSegmentUseCase(
      sessions,
      rooms,
      new RoomPermissionService(),
      transcripts,
    );
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.LIVE }),
    );
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);

    await expect(
      useCase.execute('host-1', 'session-1', 'né? ééé...', 'segment-0002'),
    ).resolves.toBeNull();
    expect(transcripts.append).not.toHaveBeenCalled();
  });

  it('captures the audience context with the canonical segment result', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const transcripts = buildTranscriptRepo();
    const useCase = new AppendTranscriptSegmentUseCase(
      sessions,
      rooms,
      new RoomPermissionService(),
      transcripts,
    );
    const audienceContext = {
      meetingType: 'empresa' as const,
      ageRange: 'adultos' as const,
      portugueseFamiliarity: 'media' as const,
      domain: 'Planejamento',
      simplificationLevel: 'moderada' as const,
    };
    const segment = new TranscriptSegment({
      id: 'transcript-context',
      sessionId: 'session-1',
      clientSegmentId: 'segment-0003',
      seq: 3,
      text: 'A pauta será apresentada.',
      cleaningStrategyVersion: 'pt-br-conservative-v1',
      createdAt: new Date('2026-08-06T12:00:00Z'),
    });
    sessions.findById.mockResolvedValue(
      buildSession({
        status: SessionStatus.LIVE,
        audienceContext,
        audienceContextVersion: 7,
      }),
    );
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.HOST);
    transcripts.append.mockResolvedValue({ segment, created: true });

    await expect(
      useCase.execute(
        'host-1',
        'session-1',
        segment.text,
        segment.clientSegmentId,
      ),
    ).resolves.toEqual({
      segment,
      created: true,
      adaptationContext: {
        context: audienceContext,
        contextVersion: 7,
      },
    });
  });
});
