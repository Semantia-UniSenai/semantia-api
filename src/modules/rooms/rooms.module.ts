import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RoomPermissionService } from './room-permission.service';
import { RoomsController } from './rooms.controller';
import { InstantMeetingRepository } from './repositories/instant-meeting.repository';
import { PrismaInstantMeetingRepository } from './repositories/prisma-instant-meeting.repository';
import { PrismaRoomRepository } from './repositories/prisma-room.repository';
import { RoomRepository } from './repositories/room.repository';
import { CreateInstantMeetingUseCase } from './usecases/create-instant-meeting.usecase';
import { GetRoomUseCase } from './usecases/get-room.usecase';
import { JoinRoomUseCase } from './usecases/join-room.usecase';
import { ListRoomsUseCase } from './usecases/list-rooms.usecase';
import { RemoveRoomMemberUseCase } from './usecases/remove-room-member.usecase';
import { UpdateRoomMemberRoleUseCase } from './usecases/update-room-member-role.usecase';
import { UpdateRoomUseCase } from './usecases/update-room.usecase';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RoomsController],
  providers: [
    { provide: RoomRepository, useClass: PrismaRoomRepository },
    {
      provide: InstantMeetingRepository,
      useClass: PrismaInstantMeetingRepository,
    },
    RoomPermissionService,
    CreateInstantMeetingUseCase,
    ListRoomsUseCase,
    GetRoomUseCase,
    JoinRoomUseCase,
    UpdateRoomUseCase,
    UpdateRoomMemberRoleUseCase,
    RemoveRoomMemberUseCase,
  ],
  exports: [RoomRepository, RoomPermissionService],
})
export class RoomsModule {}
