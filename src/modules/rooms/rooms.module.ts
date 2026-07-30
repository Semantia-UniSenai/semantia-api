import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RoomPermissionService } from './room-permission.service';
import { RoomsController } from './rooms.controller';
import { PrismaRoomRepository } from './repositories/prisma-room.repository';
import { RoomRepository } from './repositories/room.repository';
import { CreateRoomUseCase } from './usecases/create-room.usecase';
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
    RoomPermissionService,
    CreateRoomUseCase,
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
