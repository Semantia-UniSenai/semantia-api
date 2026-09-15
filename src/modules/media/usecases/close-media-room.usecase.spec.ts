import { MediaRoomProvider } from '../contracts/media-room.provider';
import { CloseMediaRoomUseCase } from './close-media-room.usecase';

describe('CloseMediaRoomUseCase', () => {
  it('delegates idempotent cleanup to the configured provider', async () => {
    const provider = {
      issueCredentials: jest.fn(),
      closeRoom: jest.fn().mockResolvedValue(undefined),
    } as unknown as MediaRoomProvider;
    const useCase = new CloseMediaRoomUseCase(provider);

    await expect(useCase.execute('session-1')).resolves.toBeUndefined();
    expect(provider.closeRoom).toHaveBeenCalledTimes(1);
    expect(provider.closeRoom).toHaveBeenCalledWith('session-1');
  });
});
