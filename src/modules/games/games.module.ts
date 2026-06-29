import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GamesController } from './games.controller';
import { PrismaScoreRepository } from './repositories/prisma-score.repository';
import { ScoreRepository } from './repositories/score.repository';
import { GetRankingUseCase } from './usecases/get-ranking.usecase';
import { ListMyScoresUseCase } from './usecases/list-my-scores.usecase';
import { SubmitScoreUseCase } from './usecases/submit-score.usecase';

@Module({
  imports: [AuthModule], // re-exports JwtModule so JwtAuthGuard can verify tokens
  controllers: [GamesController],
  providers: [
    SubmitScoreUseCase,
    ListMyScoresUseCase,
    GetRankingUseCase,
    { provide: ScoreRepository, useClass: PrismaScoreRepository },
    // JwtAuthGuard depends on JwtService (provided via AuthModule's JwtModule).
    // Listed here so @UseGuards(JwtAuthGuard) can resolve it.
  ],
})
export class GamesModule {}
