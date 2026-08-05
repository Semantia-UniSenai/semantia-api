import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AsrClient } from './asr-client';
import { HttpAsrClient } from './http-asr.client';
import { SessionTranscriptionCoordinator } from './session-transcription-coordinator';
import { TranscribeAudioSegmentUseCase } from './usecases/transcribe-audio-segment.usecase';

@Module({
  imports: [RoomsModule, SessionsModule],
  providers: [
    SessionTranscriptionCoordinator,
    TranscribeAudioSegmentUseCase,
    { provide: AsrClient, useClass: HttpAsrClient },
  ],
  exports: [TranscribeAudioSegmentUseCase],
})
export class AsrModule {}
