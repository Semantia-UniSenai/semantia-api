import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaRoomProvider } from './contracts/media-room.provider';
import { LiveKitMediaRoomProvider } from './infrastructure/livekit-media-room.provider';
import { CloseMediaRoomUseCase } from './usecases/close-media-room.usecase';
import { IssueMediaCredentialsUseCase } from './usecases/issue-media-credentials.usecase';

@Module({
  imports: [ConfigModule],
  providers: [
    IssueMediaCredentialsUseCase,
    CloseMediaRoomUseCase,
    { provide: MediaRoomProvider, useClass: LiveKitMediaRoomProvider },
  ],
  exports: [IssueMediaCredentialsUseCase, CloseMediaRoomUseCase],
})
export class MediaModule {}
