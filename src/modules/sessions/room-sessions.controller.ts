import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/guards/jwt-auth.guard';
import { CreateSessionDto } from './dtos/create-session.dto';
import { SessionDto } from './dtos/session-response.dto';
import { RoomSession } from './entities/live-session.entity';
import { CreateSessionUseCase } from './usecases/create-session.usecase';
import { ListRoomSessionsUseCase } from './usecases/list-room-sessions.usecase';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomSessionsController {
  constructor(
    private readonly createSession: CreateSessionUseCase,
    private readonly listSessions: ListRoomSessionsUseCase,
  ) {}

  @Post(':roomId/sessions')
  @ApiOperation({
    operationId: 'createRoomSession',
    summary: 'Create a session in PREPARING state',
  })
  @ApiResponse({ status: 201, type: SessionDto })
  create(
    @CurrentUser() actor: AuthUser,
    @Param('roomId') roomId: string,
    @Body() dto: CreateSessionDto,
  ): Promise<RoomSession> {
    return this.createSession.execute(actor, roomId, dto);
  }

  @Get(':roomId/sessions')
  @ApiOperation({
    operationId: 'listRoomSessions',
    summary: 'List sessions of an accessible room',
  })
  @ApiResponse({ status: 200, type: [SessionDto] })
  list(
    @CurrentUser() actor: AuthUser,
    @Param('roomId') roomId: string,
  ): Promise<RoomSession[]> {
    return this.listSessions.execute(actor, roomId);
  }
}
