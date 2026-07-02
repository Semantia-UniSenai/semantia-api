import { ChatMessageWithAuthor } from '../entities/chat-message.entity';

export interface CreateChatMessageData {
  sessionId: string;
  userId: string;
  text: string;
}

/**
 * ChatMessageRepository — abstract contract for live session chat
 * persistence. Reads come back enriched with the author's name/role so the
 * gateway can broadcast display-ready payloads.
 */
export abstract class ChatMessageRepository {
  abstract create(data: CreateChatMessageData): Promise<ChatMessageWithAuthor>;
  abstract findLast(
    sessionId: string,
    limit: number,
  ): Promise<ChatMessageWithAuthor[]>;
}
