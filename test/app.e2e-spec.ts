import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

jest.setTimeout(30_000);

type Json = Record<string, any>;

type Ack =
  | ({ ok: true } & Json)
  | { ok: false; error: { code: string; message: string } };

const waitFor = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for ${event}`)),
      5_000,
    );
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });

const emitAck = (socket: Socket, event: string, payload?: Json): Promise<Ack> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for ack ${event}`)),
      5_000,
    );
    const done = (ack: Ack) => {
      clearTimeout(timer);
      resolve(ack);
    };
    if (payload === undefined) socket.emit(event, done);
    else socket.emit(event, payload, done);
  });

const connect = (url: string, token: string): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = io(`${url}/live`, {
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, 5_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

describe('generic communication rooms (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let hostSocket: Socket | undefined;
  let guestSocket: Socket | undefined;
  let previousAsrMode: string | undefined;

  beforeAll(async () => {
    previousAsrMode = process.env.ASR_MODE;
    process.env.ASR_MODE = 'browser';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    guestSocket?.disconnect();
    hostSocket?.disconnect();
    if (app) await app.close();
    if (previousAsrMode === undefined) delete process.env.ASR_MODE;
    else process.env.ASR_MODE = previousAsrMode;
  });

  it('opens an instant meeting, invites a guest and ends it without exposing preparation', async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const hostSignup = await request(baseUrl)
      .post('/api/auth/signup')
      .send({
        name: 'Ana Anfitriã',
        email: `host-${unique}@semantia.app`,
        password: 'sup3rsecret',
      })
      .expect(201);
    expect(hostSignup.body.user).not.toHaveProperty('role');
    const hostToken = hostSignup.body.accessToken as string;

    const meetingResponse = await request(baseUrl)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({})
      .expect(201);
    const meeting = meetingResponse.body as Json;
    expect(meeting).toMatchObject({
      roomId: expect.any(String),
      meetingId: expect.any(String),
      name: 'Reunião instantânea',
      joinToken: expect.any(String),
      status: 'LIVE',
      startedAt: expect.any(String),
    });

    await request(baseUrl)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: meeting.roomId,
              meetingId: meeting.meetingId,
              meetingStatus: 'LIVE',
            }),
          ]),
        ),
      );

    await request(baseUrl)
      .post(`/api/rooms/${meeting.roomId}/sessions`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Outra ocorrência' })
      .expect(404);

    await request(baseUrl)
      .post(`/api/sessions/${meeting.meetingId}/start`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(404);

    await request(baseUrl)
      .get('/api/sessions/resolve')
      .query({ token: meeting.joinToken })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          sessionId: meeting.meetingId,
          roomId: meeting.roomId,
          roomName: 'Reunião instantânea',
          status: 'LIVE',
        }),
      );

    const guestAccess = await request(baseUrl)
      .post('/api/sessions/guest-access')
      .send({ joinToken: meeting.joinToken, displayName: 'Bruno Convidado' })
      .expect(200);
    expect(guestAccess.body.participant).toMatchObject({
      name: 'Bruno Convidado',
      role: 'GUEST',
    });

    hostSocket = await connect(baseUrl, hostToken);
    const hostState = waitFor<Json>(hostSocket, 'session:state');
    expect(
      await emitAck(hostSocket, 'session:join', {
        sessionId: meeting.meetingId,
      }),
    ).toEqual({ ok: true });
    expect(await hostState).toMatchObject({
      canManage: true,
      self: { role: 'HOST' },
    });

    guestSocket = await connect(
      baseUrl,
      guestAccess.body.accessToken as string,
    );
    const guestState = waitFor<Json>(guestSocket, 'session:state');
    expect(
      await emitAck(guestSocket, 'session:join', {
        sessionId: meeting.meetingId,
      }),
    ).toEqual({ ok: true });
    expect(await guestState).toMatchObject({
      canManage: false,
      self: { role: 'GUEST', name: 'Bruno Convidado' },
    });

    const transcriptEvent = waitFor<Json>(guestSocket, 'transcript:final');
    expect(
      await emitAck(hostSocket, 'transcript:final', {
        text: 'né, comunicação preservada.',
      }),
    ).toMatchObject({ ok: true, seq: 1 });
    expect(await transcriptEvent).toMatchObject({
      seq: 1,
      text: 'comunicação preservada.',
    });

    const chatEvent = waitFor<Json>(hostSocket, 'chat:message');
    expect(
      await emitAck(guestSocket, 'chat:send', { text: 'Mensagem convidada' }),
    ).toMatchObject({ ok: true, id: expect.any(String) });
    expect(await chatEvent).toMatchObject({
      name: 'Bruno Convidado',
      role: 'GUEST',
      text: 'Mensagem convidada',
    });

    const handEvent = waitFor<Json>(hostSocket, 'hand:raised');
    expect(await emitAck(guestSocket, 'hand:raise')).toEqual({ ok: true });
    expect(await handEvent).toMatchObject({ name: 'Bruno Convidado' });

    const leftEvent = waitFor<Json>(hostSocket, 'presence:left');
    guestSocket.disconnect();
    guestSocket = undefined;
    expect(await leftEvent).toMatchObject({
      participantId: guestAccess.body.participant.participantId,
    });

    const endedEvent = waitFor<Json>(hostSocket, 'session:ended');
    expect(await emitAck(hostSocket, 'session:end')).toEqual({ ok: true });
    expect(await endedEvent).toMatchObject({ sessionId: meeting.meetingId });

    guestSocket = await connect(
      baseUrl,
      guestAccess.body.accessToken as string,
    );
    const endedGuestState = waitFor<Json>(guestSocket, 'session:state');
    expect(
      await emitAck(guestSocket, 'session:join', {
        sessionId: meeting.meetingId,
      }),
    ).toEqual({ ok: true });
    expect(await endedGuestState).toMatchObject({
      session: { status: 'ENDED', joinToken: '' },
      canManage: false,
      self: { role: 'GUEST', name: 'Bruno Convidado' },
    });
    expect(
      await emitAck(guestSocket, 'chat:send', {
        text: 'Não pode alterar sessão encerrada',
      }),
    ).toMatchObject({ ok: false });
    guestSocket.disconnect();
    guestSocket = undefined;

    await request(baseUrl)
      .get(`/api/sessions/${meeting.meetingId}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('ENDED'));

    await request(baseUrl)
      .get(`/api/sessions/${meeting.meetingId}/transcript`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toEqual([
          expect.objectContaining({ seq: 1, text: 'comunicação preservada.' }),
        ]),
      );

    await request(baseUrl)
      .get(`/api/sessions/${meeting.meetingId}`)
      .query({ token: meeting.joinToken })
      .expect(403);
  });
});
