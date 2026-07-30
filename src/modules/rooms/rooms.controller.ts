import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/guards/jwt-auth.guard';
import {
  JoinRoomDto,
  UpdateRoomMemberRoleDto,
} from './dtos/room-membership.dto';
import {
  RoomDetailsDto,
  RoomDto,
  RoomSummaryDto,
} from './dtos/room-response.dto';
import { CreateRoomDto, UpdateRoomDto } from './dtos/room-write.dto';
import { Room, RoomDetails, RoomSummary } from './entities/room.entity';
import { CreateRoomUseCase } from './usecases/create-room.usecase';
import { GetRoomUseCase } from './usecases/get-room.usecase';
import { JoinRoomUseCase } from './usecases/join-room.usecase';
import { ListRoomsUseCase } from './usecases/list-rooms.usecase';
import { RemoveRoomMemberUseCase } from './usecases/remove-room-member.usecase';
import { UpdateRoomMemberRoleUseCase } from './usecases/update-room-member-role.usecase';
import { UpdateRoomUseCase } from './usecases/update-room.usecase';

@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly createRoom: CreateRoomUseCase,
    private readonly listRooms: ListRoomsUseCase,
    private readonly getRoom: GetRoomUseCase,
    private readonly joinRoom: JoinRoomUseCase,
    private readonly updateRoom: UpdateRoomUseCase,
    private readonly updateMemberRole: UpdateRoomMemberRoleUseCase,
    private readonly removeMember: RemoveRoomMemberUseCase,
  ) {}

  @Post()
  @ApiOperation({
    operationId: 'createRoom',
    summary: 'Create a communication room',
  })
  @ApiResponse({ status: 201, type: RoomDto })
  create(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateRoomDto,
  ): Promise<Room> {
    return this.createRoom.execute(actor, dto);
  }

  @Get()
  @ApiOperation({
    operationId: 'listRooms',
    summary: 'List rooms I host or joined',
  })
  @ApiResponse({ status: 200, type: [RoomSummaryDto] })
  list(@CurrentUser() actor: AuthUser): Promise<RoomSummary[]> {
    return this.listRooms.execute(actor);
  }

  @Post('join')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'joinRoom',
    summary: 'Join a room by invite code',
  })
  @ApiResponse({ status: 200, type: RoomDto })
  join(
    @CurrentUser() actor: AuthUser,
    @Body() dto: JoinRoomDto,
  ): Promise<Room> {
    return this.joinRoom.execute(actor, dto.inviteCode);
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getRoom', summary: 'Get an accessible room' })
  @ApiResponse({ status: 200, type: RoomDetailsDto })
  details(
    @CurrentUser() actor: AuthUser,
    @Param('id') roomId: string,
  ): Promise<RoomDetails> {
    return this.getRoom.execute(actor, roomId);
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateRoom',
    summary: 'Update room configuration',
  })
  @ApiResponse({ status: 200, type: RoomDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') roomId: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<Room> {
    return this.updateRoom.execute(actor, roomId, dto.name);
  }

  @Patch(':id/members/:userId/role')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'updateRoomMemberRole',
    summary: 'Assign moderator or participant role (host only)',
  })
  updateRole(
    @CurrentUser() actor: AuthUser,
    @Param('id') roomId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoomMemberRoleDto,
  ): Promise<void> {
    return this.updateMemberRole.execute(actor, roomId, userId, dto.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'removeRoomMember',
    summary: 'Remove a participant from the room',
  })
  remove(
    @CurrentUser() actor: AuthUser,
    @Param('id') roomId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.removeMember.execute(actor, roomId, userId);
  }
}
