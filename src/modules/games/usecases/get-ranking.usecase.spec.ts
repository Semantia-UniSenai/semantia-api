import { RankingEntry } from '../entities/score.entity';
import { ScoreRepository } from '../repositories/score.repository';
import { GetRankingUseCase } from './get-ranking.usecase';

describe('GetRankingUseCase', () => {
  let useCase: GetRankingUseCase;
  let scores: jest.Mocked<ScoreRepository>;

  beforeEach(() => {
    scores = {
      create: jest.fn(),
      findByUser: jest.fn(),
      ranking: jest.fn(),
    };
    useCase = new GetRankingUseCase(scores);
  });

  it('forwards an explicit limit to the repository', async () => {
    // Arrange
    const ranking: RankingEntry[] = [
      { rank: 1, userId: 'user-1', name: 'Ana', points: 1200 },
    ];
    scores.ranking.mockResolvedValue(ranking);

    // Act
    const result = await useCase.execute('fingerspelling', 5);

    // Assert
    expect(scores.ranking).toHaveBeenCalledWith('fingerspelling', 5);
    expect(result).toBe(ranking);
  });

  it('defaults to a limit of 20 when none is provided', async () => {
    // Arrange
    scores.ranking.mockResolvedValue([]);

    // Act
    await useCase.execute('fingerspelling');

    // Assert
    expect(scores.ranking).toHaveBeenCalledWith('fingerspelling', 20);
  });
});
