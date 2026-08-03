import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { ChatMessage } from '../entities/chat-message.entity';

export interface CreateChatMessageData {
  sessionId: string;
  participantId: string;
  participantName: string;
  participantRole: RoomParticipantRole;
  text: string;
}

export abstract class ChatMessageRepository {
  abstract create(data: CreateChatMessageData): Promise<ChatMessage>;
  abstract findLast(sessionId: string, limit: number): Promise<ChatMessage[]>;
}
