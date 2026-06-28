import { Injectable } from '@nestjs/common';
import { Score } from '../entities/score.entity';
import { ScoreRepository } from '../repositories/score.repository';

/** ListMyScores — returns the authenticated user's scores, newest first. */
@Injectable()
export class ListMyScoresUseCase {
  constructor(private readonly scores: ScoreRepository) {}

  execute(userId: string): Promise<Score[]> {
    return this.scores.findByUser(userId);
  }
}
