import { Injectable } from '@nestjs/common';
import { MediaRoomProvider } from '../contracts/media-room.provider';

@Injectable()
export class CloseMediaRoomUseCase {
  constructor(private readonly mediaRoom: MediaRoomProvider) {}

  async execute(sessionId: string): Promise<void> {
    await this.mediaRoom.closeRoom(sessionId);
  }
}
