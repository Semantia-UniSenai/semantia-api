import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
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
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { AudienceContextDto } from './dtos/audience-context.dto';
import { AudienceContext } from './entities/audience-context.entity';
import { CreateGuestAccessDto, GuestAccessDto } from './dtos/guest-access.dto';
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
  RoomSession,
  RoomSessionDetails,
} from './entities/live-session.entity';
import { TranscriptSegment } from './entities/transcript-segment.entity';
import { CreateGuestAccessUseCase } from './usecases/create-guest-access.usecase';
import { EndSessionUseCase } from './usecases/end-session.usecase';
import { GetSessionUseCase } from './usecases/get-session.usecase';
import { GetTranscriptUseCase } from './usecases/get-transcript.usecase';
import { ResolveJoinTokenUseCase } from './usecases/resolve-join-token.usecase';
import { UpdateSessionContextUseCase } from './usecases/update-session-context.usecase';

const principalOf = (actor?: AuthUser) =>
  actor ? { participantId: actor.userId, kind: 'account' as const } : null;

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly endSession: EndSessionUseCase,
    private readonly getSession: GetSessionUseCase,
    private readonly resolveJoinToken: ResolveJoinTokenUseCase,
    private readonly createGuestAccess: CreateGuestAccessUseCase,
    private readonly getTranscript: GetTranscriptUseCase,
    private readonly updateContext: UpdateSessionContextUseCase,
  ) {}

  @Get('resolve')
  @ApiOperation({
    operationId: 'resolveSessionToken',
    summary: 'Resolve an active invitation token',
  })
  @ApiResponse({ status: 200, type: ResolvedSessionDto })
  resolve(@Query() query: ResolveTokenQueryDto): Promise<ResolvedSessionDto> {
    return this.resolveJoinToken.execute(query.token);
  }

  @Post('guest-access')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'createGuestAccess',
    summary:
      'Exchange an invite token and display name for an ephemeral identity',
  })
  @ApiResponse({ status: 200, type: GuestAccessDto })
  guest(@Body() dto: CreateGuestAccessDto): Promise<GuestAccessDto> {
    return this.createGuestAccess.execute(dto.joinToken, dto.displayName);
  }

  @Patch(':id/context')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    operationId: 'updateSessionContext',
    summary: 'Set the audience context before starting the session',
  })
  @ApiResponse({ status: 200, type: SessionDto })
  updateAudienceContext(
    @CurrentUser() actor: AuthUser,
    @Param('id') sessionId: string,
    @Body() dto: AudienceContextDto,
  ): Promise<RoomSession> {
    return this.updateContext.execute(
      actor.userId,
      sessionId,
      dto as AudienceContext,
    );
  }

  @Post(':id/end')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    operationId: 'endSession',
    summary: 'End a session idempotently',
  })
  @ApiResponse({ status: 200, type: SessionDto })
  end(
    @CurrentUser() actor: AuthUser,
    @Param('id') sessionId: string,
  ): Promise<RoomSession> {
    return this.endSession.execute(actor.userId, sessionId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    operationId: 'getSession',
    summary: 'Read session details with membership or an active invite token',
  })
  @ApiResponse({ status: 200, type: SessionDetailDto })
  details(
    @CurrentUser() actor: AuthUser | undefined,
    @Param('id') sessionId: string,
    @Query() query: SessionTokenQueryDto,
  ): Promise<RoomSessionDetails> {
    return this.getSession.execute(principalOf(actor), sessionId, query.token);
  }

  @Get(':id/transcript')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    operationId: 'getSessionTranscript',
    summary: 'Read the ordered transcript under the same session access rule',
  })
  @ApiResponse({ status: 200, type: [TranscriptSegmentDto] })
  transcript(
    @CurrentUser() actor: AuthUser | undefined,
    @Param('id') sessionId: string,
    @Query() query: SessionTokenQueryDto,
  ): Promise<TranscriptSegment[]> {
    return this.getTranscript.execute(
      principalOf(actor),
      sessionId,
      query.token,
    );
  }
}
