import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole } from '../../shared/enums/user-role.enum';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { CreateSessionDto } from './dtos/create-session.dto';
import {
  ResolvedSessionDto,
  SessionDetailDto,
  SessionDto,
  TranscriptSegmentDto,
} from './dtos/session-response.dto';
import {
  ResolveTokenQueryDto,
  SessionTokenQueryDto,
} from './dtos/session-token-query.dto';
import {
  LiveSession,
  LiveSessionDetails,
} from './entities/live-session.entity';
import { TranscriptSegment } from './entities/transcript-segment.entity';
import { CreateSessionUseCase } from './usecases/create-session.usecase';
import { EndSessionUseCase } from './usecases/end-session.usecase';
import { GetSessionUseCase } from './usecases/get-session.usecase';
import { GetTranscriptUseCase } from './usecases/get-transcript.usecase';
import { ResolveJoinTokenUseCase } from './usecases/resolve-join-token.usecase';

@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly createSessionUseCase: CreateSessionUseCase,
    private readonly endSessionUseCase: EndSessionUseCase,
    private readonly getSessionUseCase: GetSessionUseCase,
    private readonly resolveJoinTokenUseCase: ResolveJoinTokenUseCase,
    private readonly getTranscriptUseCase: GetTranscriptUseCase,
  ) {}

  @Post()
  @Roles(UserRole.PROFESSOR)
  @ApiOperation({
    operationId: 'createSession',
    summary: 'Start a live session (teacher only)',
  })
  @ApiResponse({ status: 201, type: SessionDto })
  @ApiResponse({ status: 403, description: 'Not a teacher / not your class' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  createSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSessionDto,
  ): Promise<LiveSession> {
    return this.createSessionUseCase.execute(user, dto);
  }

  @Get('resolve')
  @ApiOperation({
    operationId: 'resolveSessionToken',
    summary: 'Resolve a join token from a shared link into a session pointer',
  })
  @ApiResponse({ status: 200, type: ResolvedSessionDto })
  @ApiResponse({ status: 404, description: 'Invalid session token' })
  resolveToken(
    @Query() query: ResolveTokenQueryDto,
  ): Promise<ResolvedSessionDto> {
    return this.resolveJoinTokenUseCase.execute(query.token);
  }

  @Post(':id/end')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'endSession',
    summary: 'End a live session (owning teacher only, idempotent)',
  })
  @ApiResponse({ status: 200, type: SessionDto })
  @ApiResponse({ status: 403, description: 'Caller is not the owning teacher' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  endSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LiveSession> {
    return this.endSessionUseCase.execute(user.userId, id);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getSession',
    summary:
      'Session info. Accessible to the owner, class members, or with ?token=<joinToken>',
  })
  @ApiResponse({ status: 200, type: SessionDetailDto })
  @ApiResponse({ status: 403, description: 'No access to this session' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SessionTokenQueryDto,
  ): Promise<LiveSessionDetails> {
    return this.getSessionUseCase.execute(user.userId, id, query.token);
  }

  @Get(':id/transcript')
  @ApiOperation({
    operationId: 'getSessionTranscript',
    summary:
      'Full transcript ordered by seq (works after the session ended, same access rule)',
  })
  @ApiResponse({ status: 200, type: [TranscriptSegmentDto] })
  @ApiResponse({ status: 403, description: 'No access to this session' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getTranscript(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SessionTokenQueryDto,
  ): Promise<TranscriptSegment[]> {
    return this.getTranscriptUseCase.execute(user.userId, id, query.token);
  }
}
