import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RoomParticipantRole } from '../../rooms/entities/room.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import {
  ChatMessageRepository,
  CreateChatMessageData,
} from './chat-message.repository';

const toEntity = (row: {
  id: string;
  sessionId: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  text: string;
  createdAt: Date;
}): ChatMessage =>
  new ChatMessage({
    ...row,
    participantRole: row.participantRole as RoomParticipantRole,
  });

@Injectable()
export class PrismaChatMessageRepository extends ChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateChatMessageData): Promise<ChatMessage> {
    return toEntity(await this.prisma.chatMessage.create({ data }));
  }

  async findLast(sessionId: string, limit: number): Promise<ChatMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.reverse().map(toEntity);
  }
}
