import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { SessionStatus } from '../entities/live-session.entity';
import { ChatMessageRepository } from '../repositories/chat-message.repository';
import { RoomSessionRepository } from '../repositories/live-session.repository';

export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export interface ChatAuthor {
  participantId: string;
  name: string;
  role: RoomParticipantRole;
}

@Injectable()
export class SendChatMessageUseCase {
  constructor(
    private readonly sessions: RoomSessionRepository,
    private readonly messages: ChatMessageRepository,
  ) {}

  async execute(
    author: ChatAuthor,
    sessionId: string,
    text: string,
  ): Promise<ChatMessage> {
    const trimmed = text?.trim();
    if (!trimmed) throw new BadRequestException('Message must not be empty');
    if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message must be at most ${MAX_CHAT_MESSAGE_LENGTH} characters`,
      );
    }
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== SessionStatus.LIVE) {
      throw new ConflictException('Session is read-only');
    }
    return this.messages.create({
      sessionId,
      participantId: author.participantId,
      participantName: author.name,
      participantRole: author.role,
      text: trimmed,
    });
  }
}
