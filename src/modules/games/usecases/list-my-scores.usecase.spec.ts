import { Score } from '../entities/score.entity';
import { ScoreRepository } from '../repositories/score.repository';
import { ListMyScoresUseCase } from './list-my-scores.usecase';

describe('ListMyScoresUseCase', () => {
  let useCase: ListMyScoresUseCase;
  let scores: jest.Mocked<ScoreRepository>;

  beforeEach(() => {
    scores = {
      create: jest.fn(),
      findByUser: jest.fn(),
      ranking: jest.fn(),
    };
    useCase = new ListMyScoresUseCase(scores);
  });

  it('returns the scores for the authenticated user', async () => {
    // Arrange
    const rows = [
      new Score({
        id: 'score-1',
        userId: 'user-1',
        gameKey: 'fingerspelling',
        points: 1200,
        accuracy: null,
        durationMs: null,
        createdAt: new Date(),
      }),
    ];
    scores.findByUser.mockResolvedValue(rows);

    // Act
    const result = await useCase.execute('user-1');

    // Assert
    expect(scores.findByUser).toHaveBeenCalledWith('user-1');
    expect(result).toBe(rows);
  });
});
