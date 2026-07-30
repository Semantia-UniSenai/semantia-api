import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { SessionsModule } from '../sessions/sessions.module';
import { LiveGateway } from './live.gateway';
import { LiveRoomStateService } from './live-room-state.service';

@Module({
  imports: [AuthModule, RoomsModule, SessionsModule],
  providers: [LiveGateway, LiveRoomStateService],
})
export class LiveModule {}
