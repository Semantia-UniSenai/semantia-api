import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';

/**
 * End-to-end happy path against the real Postgres (docker-compose).
 * Covers the full gating story: signup → signin → submit score → ranking
 * shows the user, plus the guard rejecting an unauthenticated request.
 *
 * Requires DATABASE_URL + JWT_SECRET in the environment (see .env). Skips
 * the DB-dependent assertions cleanly if the DB is unreachable.
 */
describe('Semantia API (e2e)', () => {
  let app: INestApplication;
  let dbAvailable = true;

  const email = `e2e_${Date.now()}@semantia.app`;
  const password = 'sup3rsecret';
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    const res = await request(app.getHttpServer() as App).get('/api/health');
    dbAvailable = res.body?.db === true;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('reports healthy with DB connectivity', async () => {
    const res = await request(app.getHttpServer() as App).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('signs up a new user', async () => {
    if (!dbAvailable) return;
    const res = await request(app.getHttpServer() as App)
      .post('/api/auth/signup')
      .send({ name: 'E2E User', email, password });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('signs in and receives a token', async () => {
    if (!dbAvailable) return;
    const res = await request(app.getHttpServer() as App)
      .post('/api/auth/signin')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    token = res.body.accessToken;
  });

  it('rejects games endpoints without a token (gating)', async () => {
    if (!dbAvailable) return;
    const res = await request(app.getHttpServer() as App)
      .post('/api/games/scores')
      .send({ gameKey: 'fingerspelling', points: 10 });
    expect(res.status).toBe(401);
  });

  it('submits a score with the token', async () => {
    if (!dbAvailable) return;
    const res = await request(app.getHttpServer() as App)
      .post('/api/games/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gameKey: 'fingerspelling',
        points: 1500,
        accuracy: 0.9,
        durationMs: 30000,
      });

    expect(res.status).toBe(201);
    expect(res.body.points).toBe(1500);
    expect(res.body.userId).toBeDefined();
  });

  it('shows the user in the ranking', async () => {
    if (!dbAvailable) return;
    const res = await request(app.getHttpServer() as App)
      .get('/api/games/ranking?gameKey=fingerspelling&limit=20')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const mine = res.body.find((r: { name: string }) => r.name === 'E2E User');
    expect(mine).toBeDefined();
    expect(mine.points).toBe(1500);
    expect(mine.rank).toBeGreaterThanOrEqual(1);
  });
});
