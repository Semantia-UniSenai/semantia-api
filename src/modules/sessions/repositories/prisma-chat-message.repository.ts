import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UserRole } from '../../../shared/enums/user-role.enum';
import { ChatMessageWithAuthor } from '../entities/chat-message.entity';
import {
  ChatMessageRepository,
  CreateChatMessageData,
} from './chat-message.repository';

type MessageRow = {
  id: string;
  sessionId: string;
  userId: string;
  text: string;
  createdAt: Date;
  user: { name: string; role: string };
};

const toEntity = (row: MessageRow): ChatMessageWithAuthor => {
  const { user, ...message } = row;
  return new ChatMessageWithAuthor({
    ...message,
    name: user.name,
    role: user.role as UserRole,
  });
};

/** Prisma-backed ChatMessageRepository. */
@Injectable()
export class PrismaChatMessageRepository extends ChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateChatMessageData): Promise<ChatMessageWithAuthor> {
    const row = await this.prisma.chatMessage.create({
      data,
      include: { user: { select: { name: true, role: true } } },
    });
    return toEntity(row);
  }

  async findLast(
    sessionId: string,
    limit: number,
  ): Promise<ChatMessageWithAuthor[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true, role: true } } },
    });
    return rows.reverse().map(toEntity);
  }
}
