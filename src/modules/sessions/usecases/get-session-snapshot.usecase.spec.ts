import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { ChatMessageWithAuthor } from '../entities/chat-message.entity';
import { TranscriptSegment } from '../entities/transcript-segment.entity';
import {
  buildChatRepo,
  buildClassRepo,
  buildSession,
  buildSessionDetails,
  buildSessionRepo,
  buildTranscriptRepo,
} from '../testing/session-test.helpers';
import { CheckSessionAccessUseCase } from './check-session-access.usecase';
import {
  CHAT_HISTORY_LIMIT,
  GetSessionSnapshotUseCase,
  TRANSCRIPT_TAIL_LIMIT,
} from './get-session-snapshot.usecase';

describe('GetSessionSnapshotUseCase', () => {
  let useCase: GetSessionSnapshotUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;
  let classes: ReturnType<typeof buildClassRepo>;
  let messages: ReturnType<typeof buildChatRepo>;
  let transcripts: ReturnType<typeof buildTranscriptRepo>;

  beforeEach(() => {
    sessions = buildSessionRepo();
    classes = buildClassRepo();
    messages = buildChatRepo();
    transcripts = buildTranscriptRepo();
    useCase = new GetSessionSnapshotUseCase(
      new CheckSessionAccessUseCase(sessions, classes),
      sessions,
      messages,
      transcripts,
    );
    sessions.findDetailsById.mockResolvedValue(buildSessionDetails());
    messages.findLast.mockResolvedValue([]);
    transcripts.findLast.mockResolvedValue([]);
  });

  it('returns the snapshot to the owning teacher (isOwner true)', async () => {
    // Arrange
    sessions.findById.mockResolvedValue(buildSession());
    const details = buildSessionDetails();
    sessions.findDetailsById.mockResolvedValue(details);

    // Act
    const result = await useCase.execute('teacher-1', 'session-1');

    // Assert
    expect(result.session).toBe(details);
    expect(result.isOwner).toBe(true);
    expect(messages.findLast).toHaveBeenCalledWith(
      'session-1',
      CHAT_HISTORY_LIMIT,
    );
    expect(transcripts.findLast).toHaveBeenCalledWith(
      'session-1',
      TRANSCRIPT_TAIL_LIMIT,
    );
  });

  it('grants a member of the session class (isOwner false)', async () => {
    sessions.findById.mockResolvedValue(buildSession({ classId: 'class-1' }));
    classes.isMember.mockResolvedValue(true);

    const result = await useCase.execute('student-1', 'session-1');

    expect(result.isOwner).toBe(false);
    expect(classes.isMember).toHaveBeenCalledWith('class-1', 'student-1');
  });

  it('grants any authenticated user with a valid joinToken', async () => {
    sessions.findById.mockResolvedValue(buildSession());

    const result = await useCase.execute(
      'stranger-1',
      'session-1',
      'tok_abc123',
    );

    expect(result.isOwner).toBe(false);
  });

  it('includes the recent chat and transcript tail in the snapshot', async () => {
    sessions.findById.mockResolvedValue(buildSession());
    const chat = [
      new ChatMessageWithAuthor({
        id: 'msg-1',
        sessionId: 'session-1',
        userId: 'student-1',
        text: 'Tenho uma dúvida',
        createdAt: new Date(),
        name: 'Ana',
        role: UserRole.ALUNO,
      }),
    ];
    const transcript = [
      new TranscriptSegment({
        id: 'seg-1',
        sessionId: 'session-1',
        seq: 1,
        text: 'Bom dia, turma',
        createdAt: new Date(),
      }),
    ];
    messages.findLast.mockResolvedValue(chat);
    transcripts.findLast.mockResolvedValue(transcript);

    const result = await useCase.execute('teacher-1', 'session-1');

    expect(result.chat).toBe(chat);
    expect(result.transcript).toBe(transcript);
  });

  it('propagates access denial without loading chat or transcript', async () => {
    sessions.findById.mockResolvedValue(buildSession());

    await expect(
      useCase.execute('stranger-1', 'session-1', 'wrong-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.findLast).not.toHaveBeenCalled();
    expect(transcripts.findLast).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown session', async () => {
    sessions.findById.mockResolvedValue(null);

    await expect(useCase.execute('teacher-1', 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws 404 when the details vanish between checks', async () => {
    sessions.findById.mockResolvedValue(buildSession());
    sessions.findDetailsById.mockResolvedValue(null);

    await expect(
      useCase.execute('teacher-1', 'session-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
