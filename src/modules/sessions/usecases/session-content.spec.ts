import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { RoomPermissionService } from '../../rooms/room-permission.service';
import { ChatMessage } from '../entities/chat-message.entity';
import { SessionStatus } from '../entities/live-session.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import {
  buildChatRepo,
  buildRoomRepo,
  buildSession,
  buildSessionRepo,
  buildTranscriptRepo,
} from '../testing/session-test.helpers';
import { AppendTranscriptSegmentUseCase } from './append-transcript-segment.usecase';
import { SendChatMessageUseCase } from './send-chat-message.usecase';

describe('live room content rules', () => {
  const permissions = new RoomPermissionService();

  it('lets a moderator publish a cleaned final transcript segment', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    const transcripts = buildTranscriptRepo();
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.LIVE, startedAt: new Date() }),
    );
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.MODERATOR);
    const segment = new TranscriptSegment({
      id: 'segment-1',
      sessionId: 'session-1',
      seq: 1,
      text: 'Vamos começar.',
      createdAt: new Date(),
    });
    transcripts.append.mockResolvedValue(segment);
    const result = await new AppendTranscriptSegmentUseCase(
      sessions,
      rooms,
      permissions,
      transcripts,
    ).execute('moderator-1', 'session-1', 'né, vamos começar.');
    expect(result).toBe(segment);
    expect(transcripts.append).toHaveBeenCalledWith(
      'session-1',
      'vamos começar.',
    );
  });

  it('rejects transcript publication by a participant', async () => {
    const sessions = buildSessionRepo();
    const rooms = buildRoomRepo();
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.LIVE }),
    );
    rooms.getParticipantRole.mockResolvedValue(RoomParticipantRole.PARTICIPANT);
    await expect(
      new AppendTranscriptSegmentUseCase(
        sessions,
        rooms,
        permissions,
        buildTranscriptRepo(),
      ).execute('participant-1', 'session-1', 'texto'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('persists guest chat with its ephemeral contextual identity', async () => {
    const sessions = buildSessionRepo();
    const messages = buildChatRepo();
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.LIVE }),
    );
    const stored = new ChatMessage({
      id: 'message-1',
      sessionId: 'session-1',
      participantId: 'guest:1',
      participantName: 'Bruno',
      participantRole: RoomParticipantRole.GUEST,
      text: 'Olá',
      createdAt: new Date(),
    });
    messages.create.mockResolvedValue(stored);
    const result = await new SendChatMessageUseCase(sessions, messages).execute(
      {
        participantId: 'guest:1',
        name: 'Bruno',
        role: RoomParticipantRole.GUEST,
      },
      'session-1',
      ' Olá ',
    );
    expect(result).toBe(stored);
    expect(messages.create).toHaveBeenCalledWith({
      sessionId: 'session-1',
      participantId: 'guest:1',
      participantName: 'Bruno',
      participantRole: RoomParticipantRole.GUEST,
      text: 'Olá',
    });
  });

  it('makes ended sessions read-only', async () => {
    const sessions = buildSessionRepo();
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.ENDED, endedAt: new Date() }),
    );
    await expect(
      new SendChatMessageUseCase(sessions, buildChatRepo()).execute(
        {
          participantId: 'participant-1',
          name: 'Pessoa',
          role: RoomParticipantRole.PARTICIPANT,
        },
        'session-1',
        'Olá',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
