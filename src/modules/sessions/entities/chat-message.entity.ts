import { RoomParticipantRole } from '../../rooms/entities/room.entity';

export class ChatMessage {
  id: string;
  sessionId: string;
  participantId: string;
  participantName: string;
  participantRole: RoomParticipantRole;
  text: string;
  createdAt: Date;

  constructor(props: ChatMessage) {
    Object.assign(this, props);
  }
}
