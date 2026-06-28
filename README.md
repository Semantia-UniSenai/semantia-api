# Semantia API

Backend for **Semantia**, a LIBRAS (Brazilian Sign Language) learning web app.
It provides authentication and a **gated games feature** (fingerspelling
training + leaderboard). The data model is future-proofed for a wider "Jogos"
hub: new games slot in via a `gameKey` string with **no schema change**.

## Stack

| Concern          | Choice                                                    |
| ---------------- | --------------------------------------------------------- |
| Framework        | NestJS 11 (TypeScript, strict)                            |
| Database         | PostgreSQL 16                                             |
| ORM              | Prisma 7 (engine-less, **pg driver adapter**)             |
| Auth             | JWT (`@nestjs/jwt`, 7-day expiry) + bcryptjs hashing      |
| Validation       | `class-validator` / `class-transformer` (global pipe)     |
| API docs         | Swagger / OpenAPI at `/docs` and `/docs-json`             |
| Package manager  | pnpm                                                      |
| Tests            | Jest (unit + 1 e2e)                                       |

> **Prisma 7 note:** Prisma 7 dropped engine-based connections. The runtime
> client requires a **driver adapter** (`@prisma/adapter-pg`), the connection
> URL lives in `prisma.config.ts` (not in `schema.prisma`), and the generated
> client is emitted to `generated/prisma`. All of this is wired up already.

## Architecture

Clean Architecture + Repository Pattern. See [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for the full layering and a guide to adding new modules/games.

```
src/
├── database/                 # PrismaService (+ global PrismaModule)
├── modules/
│   ├── auth/                 # signup / signin / me
│   │   ├── dtos/ entities/ repositories/ usecases/
│   │   ├── auth.controller.ts
│   │   └── auth.module.ts
│   ├── games/                # gated feature: scores + ranking
│   └── health/               # liveness + DB ping
└── shared/
    ├── filters/              # AllExceptionsFilter (global)
    ├── guards/               # JwtAuthGuard
    └── decorators/           # @CurrentUser()
```

**Layering rule:** usecases hold business logic and depend on a repository
**interface** (an abstract class used as the DI token), never on Prisma.
Controllers are thin: validate DTO → call usecase → return.

## Getting started (local)

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres (docker-compose)
docker compose up -d

# 3. Configure env
cp .env.example .env        # defaults already match docker-compose

# 4. Generate the Prisma client + apply the schema
pnpm prisma generate
pnpm prisma migrate dev --name init

# 5. Run the API in watch mode
pnpm start:dev
```

API is served at `http://localhost:3000/api`. Swagger UI at
`http://localhost:3000/docs`, raw OpenAPI at `http://localhost:3000/docs-json`.

## Environment variables

| Var           | Description                                  | Default (dev)               |
| ------------- | -------------------------------------------- | --------------------------- |
| `DATABASE_URL`| Postgres connection string                   | local docker-compose URL    |
| `JWT_SECRET`  | Secret used to sign JWTs (7-day expiry)      | — (set in `.env`)           |
| `CORS_ORIGIN` | Allowed CORS origin                          | `*`                         |
| `PORT`        | HTTP port                                    | `3000`                      |

## Endpoints (all under `/api`)

| Method | Path                  | Auth   | operationId    | Description                       |
| ------ | --------------------- | ------ | -------------- | --------------------------------- |
| POST   | `/auth/signup`        | public | `signUp`       | Register → `{accessToken, user}`  |
| POST   | `/auth/signin`        | public | `signIn`       | Login → `{accessToken, user}`     |
| GET    | `/auth/me`            | JWT    | `getMe`        | Current user                      |
| POST   | `/games/scores`       | JWT    | `submitScore`  | Submit a score                    |
| GET    | `/games/scores/me`    | JWT    | `listMyScores` | Current user's scores (desc)      |
| GET    | `/games/ranking`      | JWT    | `getRanking`   | Leaderboard (best per user)       |
| GET    | `/health`             | public | `getHealth`    | `{status:'ok', db:true}`          |

The OpenAPI spec exposes explicit `operationId`s, tags, and typed responses so
the frontend can generate a clean **orval** client from `/docs-json`.

### Quick curl walkthrough

```bash
B=http://localhost:3000/api
curl -s $B/health
TOKEN=$(curl -s -X POST $B/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana@semantia.app","password":"sup3rsecret"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s -X POST $B/games/scores -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"gameKey":"fingerspelling","points":1500,"accuracy":0.9,"durationMs":30000}'
curl -s "$B/games/ranking?gameKey=fingerspelling" -H "Authorization: Bearer $TOKEN"
```

## Tests

```bash
pnpm test          # unit tests (every usecase + light controller specs)
pnpm test:e2e      # one end-to-end happy path (needs the docker Postgres up)
pnpm test:cov      # coverage
```

- **Unit:** every usecase is tested in isolation with a mocked repository
  interface (happy path + key error, e.g. duplicate-email → 409, wrong
  password → 401).
- **e2e:** `test/app.e2e-spec.ts` boots the real app against the docker
  Postgres and walks signup → signin → submit score → ranking, plus the 401
  gating check. It self-skips DB-dependent assertions if the DB is unreachable.

## Deploy (Render)

`render.yaml` is a Blueprint defining a web service + managed Postgres:

- **Build:** `pnpm i && pnpm prisma generate && pnpm build`
- **Start:** `pnpm prisma migrate deploy && node dist/main`
- **Env:** `DATABASE_URL` (auto-wired from the DB), `JWT_SECRET` (generated),
  `CORS_ORIGIN` (set to the frontend origin in prod).

A multi-stage `Dockerfile` is also provided (build → prune → run, applying
`prisma migrate deploy` on boot) for container-based hosts.

## Future TODO (out of scope for the MVP deadline)

- **MCP server** for the API — intentionally deferred.
- Refresh tokens / token rotation.
- Per-game metadata table (currently games are identified only by `gameKey`).
- Rate limiting on auth endpoints.
