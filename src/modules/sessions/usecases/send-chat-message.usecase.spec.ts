import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { ChatMessageWithAuthor } from '../entities/chat-message.entity';
import { SessionStatus } from '../entities/live-session.entity';
import {
  buildChatRepo,
  buildSession,
  buildSessionRepo,
} from '../testing/session-test.helpers';
import { SendChatMessageUseCase } from './send-chat-message.usecase';

describe('SendChatMessageUseCase', () => {
  let useCase: SendChatMessageUseCase;
  let sessions: ReturnType<typeof buildSessionRepo>;
  let messages: ReturnType<typeof buildChatRepo>;

  beforeEach(() => {
    sessions = buildSessionRepo();
    messages = buildChatRepo();
    useCase = new SendChatMessageUseCase(sessions, messages);
  });

  it('persists a trimmed message in a LIVE session', async () => {
    // Arrange
    sessions.findById.mockResolvedValue(buildSession());
    const stored = new ChatMessageWithAuthor({
      id: 'msg-1',
      sessionId: 'session-1',
      userId: 'student-1',
      text: 'Tenho uma dúvida',
      createdAt: new Date(),
      name: 'Ana',
      role: UserRole.ALUNO,
    });
    messages.create.mockResolvedValue(stored);

    // Act
    const result = await useCase.execute(
      'student-1',
      'session-1',
      '  Tenho uma dúvida  ',
    );

    // Assert
    expect(messages.create).toHaveBeenCalledWith({
      sessionId: 'session-1',
      userId: 'student-1',
      text: 'Tenho uma dúvida',
    });
    expect(result).toBe(stored);
  });

  it('rejects empty or whitespace-only messages', async () => {
    await expect(
      useCase.execute('student-1', 'session-1', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(messages.create).not.toHaveBeenCalled();
  });

  it('rejects messages longer than 2000 characters', async () => {
    await expect(
      useCase.execute('student-1', 'session-1', 'a'.repeat(2001)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sessions.findById).not.toHaveBeenCalled();
  });

  it('accepts a message with exactly 2000 characters', async () => {
    sessions.findById.mockResolvedValue(buildSession());
    messages.create.mockResolvedValue({} as ChatMessageWithAuthor);

    await useCase.execute('student-1', 'session-1', 'a'.repeat(2000));

    expect(messages.create).toHaveBeenCalled();
  });

  it('rejects chat after the session ended', async () => {
    sessions.findById.mockResolvedValue(
      buildSession({ status: SessionStatus.ENDED, endedAt: new Date() }),
    );

    await expect(
      useCase.execute('student-1', 'session-1', 'oi'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws 404 for an unknown session', async () => {
    sessions.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('student-1', 'ghost', 'oi'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
