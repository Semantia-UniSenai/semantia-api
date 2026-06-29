import { Injectable } from '@nestjs/common';
import { CreateScoreDto } from '../dtos/create-score.dto';
import { Score } from '../entities/score.entity';
import { ScoreRepository } from '../repositories/score.repository';

/**
 * SubmitScore — records a score for the authenticated user.
 * The userId comes from the verified token, never from the request body.
 */
@Injectable()
export class SubmitScoreUseCase {
  constructor(private readonly scores: ScoreRepository) {}

  execute(userId: string, dto: CreateScoreDto): Promise<Score> {
    return this.scores.create({
      userId,
      gameKey: dto.gameKey,
      points: dto.points,
      accuracy: dto.accuracy ?? null,
      durationMs: dto.durationMs ?? null,
    });
  }
}
