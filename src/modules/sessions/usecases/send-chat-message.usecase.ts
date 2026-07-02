import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatMessageWithAuthor } from '../entities/chat-message.entity';
import { SessionStatus } from '../entities/live-session.entity';
import { ChatMessageRepository } from '../repositories/chat-message.repository';
import { LiveSessionRepository } from '../repositories/live-session.repository';

export const MAX_CHAT_MESSAGE_LENGTH = 2000;

/**
 * SendChatMessage — persists a chat message in a LIVE session. Access to the
 * session was already established when the participant joined the room; this
 * usecase enforces content rules and the LIVE-only write window.
 */
@Injectable()
export class SendChatMessageUseCase {
  constructor(
    private readonly sessions: LiveSessionRepository,
    private readonly messages: ChatMessageRepository,
  ) {}

  async execute(
    actorUserId: string,
    sessionId: string,
    text: string,
  ): Promise<ChatMessageWithAuthor> {
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadRequestException('Message must not be empty');
    }
    if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
      );
    }

    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.status !== SessionStatus.LIVE) {
      throw new ConflictException('Session has already ended');
    }

    return this.messages.create({
      sessionId,
      userId: actorUserId,
      text: trimmed,
    });
  }
}
