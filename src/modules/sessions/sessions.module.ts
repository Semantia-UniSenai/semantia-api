import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassesModule } from '../classes/classes.module';
import { ClassSessionsController } from './class-sessions.controller';
import { ChatMessageRepository } from './repositories/chat-message.repository';
import { LiveSessionRepository } from './repositories/live-session.repository';
import { PrismaChatMessageRepository } from './repositories/prisma-chat-message.repository';
import { PrismaLiveSessionRepository } from './repositories/prisma-live-session.repository';
import { PrismaTranscriptRepository } from './repositories/prisma-transcript.repository';
import { TranscriptRepository } from './repositories/transcript.repository';
import { SessionsController } from './sessions.controller';
import { AppendTranscriptSegmentUseCase } from './usecases/append-transcript-segment.usecase';
import { CheckSessionAccessUseCase } from './usecases/check-session-access.usecase';
import { CreateSessionUseCase } from './usecases/create-session.usecase';
import { EndSessionUseCase } from './usecases/end-session.usecase';
import { GetSessionSnapshotUseCase } from './usecases/get-session-snapshot.usecase';
import { GetSessionUseCase } from './usecases/get-session.usecase';
import { GetTranscriptUseCase } from './usecases/get-transcript.usecase';
import { ListClassSessionsUseCase } from './usecases/list-class-sessions.usecase';
import { ResolveJoinTokenUseCase } from './usecases/resolve-join-token.usecase';
import { SendChatMessageUseCase } from './usecases/send-chat-message.usecase';

@Module({
  // AuthModule re-exports JwtModule (JwtAuthGuard); ClassesModule exports
  // ClassRepository (ownership/membership checks).
  imports: [AuthModule, ClassesModule],
  controllers: [SessionsController, ClassSessionsController],
  providers: [
    CreateSessionUseCase,
    EndSessionUseCase,
    CheckSessionAccessUseCase,
    GetSessionUseCase,
    GetSessionSnapshotUseCase,
    ResolveJoinTokenUseCase,
    GetTranscriptUseCase,
    ListClassSessionsUseCase,
    AppendTranscriptSegmentUseCase,
    SendChatMessageUseCase,
    { provide: LiveSessionRepository, useClass: PrismaLiveSessionRepository },
    { provide: TranscriptRepository, useClass: PrismaTranscriptRepository },
    { provide: ChatMessageRepository, useClass: PrismaChatMessageRepository },
  ],
  // The live gateway reuses the exact same usecases (single access rule).
  exports: [
    CheckSessionAccessUseCase,
    GetSessionSnapshotUseCase,
    EndSessionUseCase,
    AppendTranscriptSegmentUseCase,
    SendChatMessageUseCase,
  ],
})
export class SessionsModule {}
