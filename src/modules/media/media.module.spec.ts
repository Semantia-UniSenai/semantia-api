import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MediaRoomProvider } from './contracts/media-room.provider';
import { MediaModule } from './media.module';
import { CloseMediaRoomUseCase } from './usecases/close-media-room.usecase';

describe('MediaModule', () => {
  it('starts without provider credentials and exports the use cases', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
        MediaModule,
      ],
    }).compile();

    expect(moduleRef.get(CloseMediaRoomUseCase)).toBeDefined();
    expect(moduleRef.get(MediaRoomProvider)).toBeDefined();
  });
});
