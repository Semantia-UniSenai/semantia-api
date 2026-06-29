import { RankingEntry, Score } from '../entities/score.entity';

export interface CreateScoreData {
  userId: string;
  gameKey: string;
  points: number;
  accuracy?: number | null;
  durationMs?: number | null;
}

/**
 * ScoreRepository — abstract contract for score persistence and ranking.
 * The ranking query (best score per user per gameKey) lives behind this
 * interface so usecases stay free of SQL/Prisma concerns.
 */
export abstract class ScoreRepository {
  abstract create(data: CreateScoreData): Promise<Score>;
  abstract findByUser(userId: string): Promise<Score[]>;
  abstract ranking(gameKey: string, limit: number): Promise<RankingEntry[]>;
}
