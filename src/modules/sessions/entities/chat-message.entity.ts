import { UserRole } from '../../../shared/enums/user-role.enum';

/**
 * One chat message inside a live session. Plain class — no Prisma coupling.
 */
export class ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  text: string;
  createdAt: Date;

  constructor(props: ChatMessage) {
    Object.assign(this, props);
  }
}

/** Chat message enriched with the author's name/role for display. */
export class ChatMessageWithAuthor extends ChatMessage {
  name: string;
  role: UserRole;

  constructor(props: ChatMessageWithAuthor) {
    super(props);
    this.name = props.name;
    this.role = props.role;
  }
}
