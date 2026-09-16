import { Module } from '@nestjs/common';
import { AsrModule } from '../asr/asr.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { IssueMediaCredentialsUseCase } from '../media/usecases/issue-media-credentials.usecase';
import { RoomsModule } from '../rooms/rooms.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TranscriptAdaptationModule } from '../transcript-adaptation/transcript-adaptation.module';
import { LiveGateway } from './live.gateway';
import { LiveRoomStateService } from './live-room-state.service';

@Module({
  imports: [
    AuthModule,
    AsrModule,
    MediaModule,
    RoomsModule,
    SessionsModule,
    TranscriptAdaptationModule,
  ],
  providers: [IssueMediaCredentialsUseCase, LiveGateway, LiveRoomStateService],
})
export class LiveModule {}
