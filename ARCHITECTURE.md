# Architecture

Semantia follows **Clean Architecture** with the **Repository Pattern**. The
goal is that business rules (usecases) never depend on a framework or a
database — they depend only on **interfaces** they define.

## Layers

```
Controller  ──▶  UseCase  ──▶  Repository (interface)
   (HTTP)        (logic)              ▲
                                      │ implemented by
                              Prisma<X>Repository  ──▶  PrismaService  ──▶  PostgreSQL
```

| Layer            | Responsibility                                            | Knows about        |
| ---------------- | --------------------------------------------------------- | ------------------ |
| **Controller**   | HTTP only: validate DTO, call usecase, return result.     | DTOs, usecases     |
| **UseCase**      | One business action. Pure logic. One class per action.    | repo interface, entities |
| **Repository interface** | Abstract class used as the DI token. The contract. | entities           |
| **Repository impl** | Talks to Prisma; maps rows ↔ entities **inline**.      | Prisma, entities   |
| **Entity**       | Plain domain class. No decorators, no Prisma types.       | nothing            |

### Why an abstract class for the repository?

NestJS DI needs a runtime token. A TypeScript `interface` disappears at
runtime, so we use an **abstract class** as both the type and the injection
token:

```ts
// usecase depends on the abstraction
constructor(private readonly users: UserRepository) {}

// module binds the concrete implementation
{ provide: UserRepository, useClass: PrismaUserRepository }
```

Swap `PrismaUserRepository` for an in-memory or different-DB implementation
without touching a single usecase.

## The Prisma seam (Prisma 7 specifics)

Only **two kinds of files** import Prisma:

1. `database/prisma.service.ts` — extends `PrismaClient`, constructs it with
   the `@prisma/adapter-pg` driver adapter (Prisma 7 is engine-less and
   requires an adapter), and exposes `isHealthy()`.
2. `modules/*/repositories/prisma-*.repository.ts` — the concrete repos.

Everything else (usecases, controllers, entities) is Prisma-free. The
generated client lives in `generated/prisma` and the connection URL is read by
the CLI from `prisma.config.ts`.

## Auth flow

1. `SignUp` / `SignIn` usecases hash/verify with bcrypt and sign a JWT
   (`{ sub: userId, email }`, 7-day expiry).
2. `JwtAuthGuard` (in `shared/guards`) verifies the `Bearer` token and attaches
   `{ userId, email }` to the request.
3. `@CurrentUser()` (in `shared/decorators`) reads that principal in
   controllers. The userId for writes always comes from the token, never the
   request body.

`AuthModule` registers `JwtModule` and **exports** it; `GamesModule` imports
`AuthModule` so its `JwtAuthGuard` can resolve `JwtService`.

## Adding a new game

No schema change is needed — a `Score` is identified by its `gameKey` string.
To add, say, a "vocabulary" game:

1. Frontend submits scores with `gameKey: "vocabulary"`.
2. Read its leaderboard via `GET /api/games/ranking?gameKey=vocabulary`.

That's it. The existing `games` module already serves any `gameKey`.

## Adding a new module (general recipe)

1. `src/modules/<feature>/` with `dtos/ entities/ repositories/ usecases/`.
2. Define the **entity** (plain class) and a **repository abstract class**.
3. Implement `Prisma<Feature>Repository` (the only Prisma-touching file).
4. Write **one usecase class per action**, depending on the repo interface.
5. Add a thin **controller** (Swagger decorators: `@ApiTags`, per-route
   `@ApiOperation({ operationId })`, `@ApiResponse`).
6. Wire the **module**: bind `{ provide: Repo, useClass: PrismaRepo }`, list
   usecases as providers, register the controller.
7. Import the module in `app.module.ts`.
8. Unit-test each usecase with a mocked repository.

## Cross-cutting concerns

- **Validation:** global `ValidationPipe` (`whitelist`, `transform`).
- **Errors:** global `AllExceptionsFilter` normalizes every error into
  `{ statusCode, error, message, path, timestamp }`.
- **Config:** global `ConfigModule` reads `.env`.
- **Docs:** Swagger at `/docs`, JSON at `/docs-json` (orval-ready).
