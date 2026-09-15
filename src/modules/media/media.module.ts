import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaRoomProvider } from './contracts/media-room.provider';
import { LiveKitMediaRoomProvider } from './infrastructure/livekit-media-room.provider';
import { CloseMediaRoomUseCase } from './usecases/close-media-room.usecase';

@Module({
  imports: [ConfigModule],
  providers: [
    CloseMediaRoomUseCase,
    { provide: MediaRoomProvider, useClass: LiveKitMediaRoomProvider },
  ],
  exports: [MediaRoomProvider, CloseMediaRoomUseCase],
})
export class MediaModule {}
