import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { SessionDto } from './dtos/session-response.dto';
import { LiveSession } from './entities/live-session.entity';
import { ListClassSessionsUseCase } from './usecases/list-class-sessions.usecase';

/**
 * Nested route `GET /api/classes/:id/sessions`. Lives in the sessions module
 * (it is a sessions read model) but hangs off the classes URL space.
 */
@ApiTags('sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassSessionsController {
  constructor(
    private readonly listClassSessionsUseCase: ListClassSessionsUseCase,
  ) {}

  @Get(':id/sessions')
  @ApiOperation({
    operationId: 'listClassSessions',
    summary: "A class's sessions, most recent first (owner or member only)",
  })
  @ApiResponse({ status: 200, type: [SessionDto] })
  @ApiResponse({ status: 403, description: 'Not the owner nor a member' })
  @ApiResponse({ status: 404, description: 'Class not found' })
  listClassSessions(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LiveSession[]> {
    return this.listClassSessionsUseCase.execute(user, id);
  }
}
