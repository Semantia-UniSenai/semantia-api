import { MediaModule } from '../media/media.module';
import { LiveModule } from './live.module';

describe('LiveModule', () => {
  it('imports the media use cases required by LiveGateway', () => {
    const imports = Reflect.getMetadata('imports', LiveModule) as unknown[];

    expect(imports).toContain(MediaModule);
  });
});
