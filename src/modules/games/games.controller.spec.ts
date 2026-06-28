import { Score } from './entities/score.entity';
import { GamesController } from './games.controller';
import { GetRankingUseCase } from './usecases/get-ranking.usecase';
import { ListMyScoresUseCase } from './usecases/list-my-scores.usecase';
import { SubmitScoreUseCase } from './usecases/submit-score.usecase';

describe('GamesController', () => {
  let controller: GamesController;
  let submit: jest.Mocked<SubmitScoreUseCase>;
  let list: jest.Mocked<ListMyScoresUseCase>;
  let ranking: jest.Mocked<GetRankingUseCase>;

  const currentUser = { userId: 'user-1', email: 'a@a.com' };

  beforeEach(() => {
    submit = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<SubmitScoreUseCase>;
    list = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ListMyScoresUseCase>;
    ranking = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<GetRankingUseCase>;
    controller = new GamesController(submit, list, ranking);
  });

  it('submits a score for the current user', async () => {
    const dto = { gameKey: 'fingerspelling', points: 1200 };
    submit.execute.mockResolvedValue({} as Score);

    await controller.submitScore(currentUser, dto);
    expect(submit.execute).toHaveBeenCalledWith('user-1', dto);
  });

  it('lists the current user scores', async () => {
    list.execute.mockResolvedValue([]);

    await controller.listMyScores(currentUser);
    expect(list.execute).toHaveBeenCalledWith('user-1');
  });

  it('returns the ranking for the requested game and limit', async () => {
    ranking.execute.mockResolvedValue([]);

    await controller.getRanking({ gameKey: 'fingerspelling', limit: 10 });
    expect(ranking.execute).toHaveBeenCalledWith('fingerspelling', 10);
  });
});
