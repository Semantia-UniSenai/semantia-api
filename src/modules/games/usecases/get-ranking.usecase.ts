import { Injectable } from '@nestjs/common';
import { RankingEntry } from '../entities/score.entity';
import { ScoreRepository } from '../repositories/score.repository';

const DEFAULT_LIMIT = 20;

/**
 * GetRanking — leaderboard for a game: each user's best score, descending.
 * Defaults to the top 20 when no limit is provided.
 */
@Injectable()
export class GetRankingUseCase {
  constructor(private readonly scores: ScoreRepository) {}

  execute(gameKey: string, limit?: number): Promise<RankingEntry[]> {
    return this.scores.ranking(gameKey, limit ?? DEFAULT_LIMIT);
  }
}
