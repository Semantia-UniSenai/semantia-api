import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RankingEntry, Score } from '../entities/score.entity';
import { CreateScoreData, ScoreRepository } from './score.repository';

/** Prisma-backed ScoreRepository. */
@Injectable()
export class PrismaScoreRepository extends ScoreRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(data: CreateScoreData): Promise<Score> {
    const row = await this.prisma.score.create({
      data: {
        userId: data.userId,
        gameKey: data.gameKey,
        points: data.points,
        accuracy: data.accuracy ?? null,
        durationMs: data.durationMs ?? null,
      },
    });
    return new Score(row);
  }

  async findByUser(userId: string): Promise<Score[]> {
    const rows = await this.prisma.score.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => new Score(r));
  }

  /**
   * Ranking = each user's BEST (max points) score for a gameKey, ordered
   * descending. A single grouped raw query keeps it correct and fast; the
   * (gameKey, points desc) index backs the aggregation.
   */
  async ranking(gameKey: string, limit: number): Promise<RankingEntry[]> {
    const rows = await this.prisma.$queryRaw<
      { userId: string; name: string; points: number }[]
    >`
      SELECT s."userId" AS "userId", u."name" AS "name", MAX(s."points") AS "points"
      FROM "scores" s
      JOIN "users" u ON u."id" = s."userId"
      WHERE s."gameKey" = ${gameKey}
      GROUP BY s."userId", u."name"
      ORDER BY "points" DESC
      LIMIT ${limit}
    `;

    return rows.map((row, index) => ({
      rank: index + 1,
      userId: row.userId,
      name: row.name,
      points: Number(row.points),
    }));
  }
}
