import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { AuthUser } from '../../shared/guards/jwt-auth.guard';
import { CreateScoreDto } from './dtos/create-score.dto';
import { RankingEntryDto, RankingQueryDto } from './dtos/ranking.dto';
import { ScoreDto } from './dtos/score-response.dto';
import { RankingEntry, Score } from './entities/score.entity';
import { GetRankingUseCase } from './usecases/get-ranking.usecase';
import { ListMyScoresUseCase } from './usecases/list-my-scores.usecase';
import { SubmitScoreUseCase } from './usecases/submit-score.usecase';

@ApiTags('games')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('games')
export class GamesController {
  constructor(
    private readonly submitScoreUseCase: SubmitScoreUseCase,
    private readonly listMyScoresUseCase: ListMyScoresUseCase,
    private readonly getRankingUseCase: GetRankingUseCase,
  ) {}

  @Post('scores')
  @ApiOperation({ operationId: 'submitScore', summary: 'Record a game score' })
  @ApiResponse({ status: 201, type: ScoreDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  submitScore(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateScoreDto,
  ): Promise<Score> {
    return this.submitScoreUseCase.execute(user.userId, dto);
  }

  @Get('scores/me')
  @ApiOperation({
    operationId: 'listMyScores',
    summary: "List the current user's scores",
  })
  @ApiResponse({ status: 200, type: [ScoreDto] })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  listMyScores(@CurrentUser() user: AuthUser): Promise<Score[]> {
    return this.listMyScoresUseCase.execute(user.userId);
  }

  @Get('ranking')
  @ApiOperation({
    operationId: 'getRanking',
    summary: 'Leaderboard: best score per user for a game',
  })
  @ApiResponse({ status: 200, type: [RankingEntryDto] })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  getRanking(@Query() query: RankingQueryDto): Promise<RankingEntry[]> {
    return this.getRankingUseCase.execute(query.gameKey, query.limit);
  }
}
