import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { LiveGateway } from './live.gateway';
import { LiveRoomStateService } from './live-room-state.service';

@Module({
  // AuthModule: JwtService (handshake) + UserRepository (display names).
  // SessionsModule: the exact usecases the REST API uses (single access rule).
  imports: [AuthModule, SessionsModule],
  providers: [LiveGateway, LiveRoomStateService],
})
export class LiveModule {}
