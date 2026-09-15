import { SessionsController } from './sessions.controller';

describe('SessionsController lifecycle contract', () => {
  it('does not expose a second REST path for ending a live session', () => {
    expect(SessionsController.prototype).not.toHaveProperty('end');
  });
});
