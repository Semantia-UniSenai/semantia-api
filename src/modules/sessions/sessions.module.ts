import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { RoomSessionsController } from './room-sessions.controller';
import { ChatMessageRepository } from './repositories/chat-message.repository';
import { RoomSessionRepository } from './repositories/live-session.repository';
import { PrismaChatMessageRepository } from './repositories/prisma-chat-message.repository';
import { PrismaRoomSessionRepository } from './repositories/prisma-live-session.repository';
import { PrismaTranscriptRepository } from './repositories/prisma-transcript.repository';
import { TranscriptRepository } from './repositories/transcript.repository';
import { SessionsController } from './sessions.controller';
import { AppendTranscriptSegmentUseCase } from './usecases/append-transcript-segment.usecase';
import { CheckSessionAccessUseCase } from './usecases/check-session-access.usecase';
import { CreateGuestAccessUseCase } from './usecases/create-guest-access.usecase';
import { CreateSessionUseCase } from './usecases/create-session.usecase';
import { EndSessionUseCase } from './usecases/end-session.usecase';
import { GetSessionSnapshotUseCase } from './usecases/get-session-snapshot.usecase';
import { GetSessionUseCase } from './usecases/get-session.usecase';
import { GetTranscriptUseCase } from './usecases/get-transcript.usecase';
import { ListRoomSessionsUseCase } from './usecases/list-room-sessions.usecase';
import { ResolveJoinTokenUseCase } from './usecases/resolve-join-token.usecase';
import { SendChatMessageUseCase } from './usecases/send-chat-message.usecase';
import { StartSessionUseCase } from './usecases/start-session.usecase';

@Module({
  imports: [AuthModule, RoomsModule],
  controllers: [SessionsController, RoomSessionsController],
  providers: [
    CreateSessionUseCase,
    StartSessionUseCase,
    EndSessionUseCase,
    CheckSessionAccessUseCase,
    GetSessionUseCase,
    GetSessionSnapshotUseCase,
    ResolveJoinTokenUseCase,
    CreateGuestAccessUseCase,
    GetTranscriptUseCase,
    ListRoomSessionsUseCase,
    AppendTranscriptSegmentUseCase,
    SendChatMessageUseCase,
    { provide: RoomSessionRepository, useClass: PrismaRoomSessionRepository },
    { provide: TranscriptRepository, useClass: PrismaTranscriptRepository },
    { provide: ChatMessageRepository, useClass: PrismaChatMessageRepository },
  ],
  exports: [
    RoomSessionRepository,
    CheckSessionAccessUseCase,
    GetSessionSnapshotUseCase,
    EndSessionUseCase,
    AppendTranscriptSegmentUseCase,
    SendChatMessageUseCase,
  ],
})
export class SessionsModule {}
