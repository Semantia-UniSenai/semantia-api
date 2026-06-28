import { Score } from '../entities/score.entity';
import { ScoreRepository } from '../repositories/score.repository';
import { SubmitScoreUseCase } from './submit-score.usecase';

describe('SubmitScoreUseCase', () => {
  let useCase: SubmitScoreUseCase;
  let scores: jest.Mocked<ScoreRepository>;

  beforeEach(() => {
    scores = {
      create: jest.fn(),
      findByUser: jest.fn(),
      ranking: jest.fn(),
    };
    useCase = new SubmitScoreUseCase(scores);
  });

  it('persists the score using the authenticated userId from the token', async () => {
    // Arrange
    const created = new Score({
      id: 'score-1',
      userId: 'user-1',
      gameKey: 'fingerspelling',
      points: 1200,
      accuracy: 0.92,
      durationMs: 45000,
      createdAt: new Date(),
    });
    scores.create.mockResolvedValue(created);

    // Act
    const result = await useCase.execute('user-1', {
      gameKey: 'fingerspelling',
      points: 1200,
      accuracy: 0.92,
      durationMs: 45000,
    });

    // Assert — userId comes from the argument, never the DTO
    expect(scores.create).toHaveBeenCalledWith({
      userId: 'user-1',
      gameKey: 'fingerspelling',
      points: 1200,
      accuracy: 0.92,
      durationMs: 45000,
    });
    expect(result).toBe(created);
  });

  it('normalizes missing optional fields to null', async () => {
    // Arrange
    scores.create.mockResolvedValue({} as Score);

    // Act
    await useCase.execute('user-1', { gameKey: 'fingerspelling', points: 10 });

    // Assert
    expect(scores.create).toHaveBeenCalledWith({
      userId: 'user-1',
      gameKey: 'fingerspelling',
      points: 10,
      accuracy: null,
      durationMs: null,
    });
  });
});
