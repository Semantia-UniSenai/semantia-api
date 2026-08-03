# Semantia API

Backend do **Semantia**, plataforma de comunicação acessível em tempo real. A API oferece
PostgreSQL/Prisma, autenticação, sessões ao vivo, transcript, chat, presença Socket.IO e a base de
jogos já existente.

O contrato atual do produto está no
[`semantia-cerebro`](https://github.com/Semantia-UniSenai/semantia-cerebro/blob/main/produto/contrato-mvp-transcricao-tempo-real.md).
Este repositório ainda usa `PROFESSOR`, `ALUNO`, turma e aula como domínio implementado; esses
nomes são **fundação legada a migrar**, não o contrato final.

## Estado funcional

### Implementado em `dev`

- cadastro, login e identidade JWT;
- RBAC escolar atual (`PROFESSOR`/`ALUNO`);
- datilologia/ranking por `gameKey`;
- turmas, convite e membros;
- sessões ao vivo com `joinToken`, encerramento e consulta;
- transcript final persistido com sequência;
- limpeza conservadora de disfluências no backend;
- chat persistido, presença e mãos levantadas;
- Socket.IO `/live` com acks padronizados;
- health check com PostgreSQL e OpenAPI para o client do frontend.

### Planejado para o contrato atual

- sala, anfitrião/comunicador e participante genéricos;
- convidado por link sem conta obrigatória;
- contexto da plateia;
- transcript literal + adaptado pelo mesmo segmento;
- agente de IA com timeout e fallback literal;
- retenção de 30 dias para conteúdo/metadados identificáveis, logs técnicos mínimos por 90 dias,
  exclusão antecipada e limite de quatro horas;
- capacidade-alvo de 50 conexões condicionada a teste de carga.

Não anuncie itens planejados como entregues.

## Stack

| Área | Tecnologia |
|---|---|
| Framework | NestJS 11 + TypeScript strict |
| Banco | PostgreSQL 16 |
| ORM | Prisma 7 com `@prisma/adapter-pg` |
| Auth | JWT + bcryptjs |
| Tempo real | Socket.IO |
| Validação | class-validator / class-transformer |
| Contrato | Swagger `/docs` e OpenAPI `/docs-json` |
| Testes | Jest + E2E com PostgreSQL |
| Pacotes | pnpm 10 |

## Arquitetura

Clean Architecture + Repository Pattern. Regras vivem em usecases e dependem de interfaces de
repositório; Prisma fica nas implementações concretas. Controllers e gateway são finos.

Veja [`ARCHITECTURE.md`](./ARCHITECTURE.md).

```text
src/
├── database/                 # PrismaService e módulo global
├── modules/
│   ├── auth/                 # signup, signin, me e JWT
│   ├── games/                # scores e ranking
│   ├── classes/              # turmas legadas e membros
│   ├── sessions/             # sessões, transcript, chat e regras de acesso
│   ├── live/                 # gateway Socket.IO /live e presença em memória
│   └── health/               # liveness + ping real ao banco
└── shared/                   # guards, roles, decorators, filtros e utilitários
```

## Fluxo atual da transcrição

```text
browser: SpeechRecognition nativo ou Vosk/WebAssembly local
       → texto parcial/final → Socket.IO → persistência do texto final
```

A captura e o reconhecimento de fala acontecem no navegador do comunicador. Em navegadores sem
`SpeechRecognition` funcional, o frontend carrega um modelo Vosk português e executa ASR localmente
em um Web Worker. A API recebe apenas `transcript:partial` e `transcript:final` pelo namespace
`/live`; não recebe, armazena nem envia áudio a serviço de transcrição.

Somente `HOST` ou `MODERATOR` publica transcript. Segmentos parciais não são persistidos. Texto
final passa por limpeza conservadora, sequência, persistência e broadcast. Frase final composta
apenas por ruído retorna `seq: null` e não é emitida.

## Protocolo Socket.IO

Namespace `/live`, handshake com JWT e room `session:<id>`.

Eventos do cliente:

- `session:join`, `session:leave`, `session:end`;
- `transcript:partial`, `transcript:final`;
- `chat:send`;
- `hand:raise`, `hand:lower`.

Todos retornam `{ ok: true, ... }` ou `{ ok: false, error: { code, message } }`. Entrar em sessão
encerrada é permitido para replay autorizado; novas escritas são rejeitadas.

## API REST

Todas as rotas HTTP da aplicação usam o prefixo `/api`. O contrato exato e atualizado deve ser
consultado em `/docs-json`.

Módulos principais:

- `POST /auth/signup`, `POST /auth/signin`, `GET /auth/me`;
- scores e ranking em `/games`;
- CRUD de vínculo escolar atual em `/classes`;
- criação, resolução, consulta, transcript e encerramento em `/sessions`;
- `GET /health`.

## Ambiente local

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm prisma:generate
pnpm db:migrate
pnpm start:dev
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- OpenAPI: `http://localhost:3000/docs-json`

Variáveis:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão PostgreSQL |
| `JWT_SECRET` | assinatura dos tokens; obrigatória fora de teste |
| `CORS_ORIGIN` | origem permitida do frontend |
| `PORT` | porta HTTP, padrão 3000 |

Tokens de IA de etapas futuras devem permanecer em variáveis de ambiente do backend e nunca no
frontend, banco, logs, docs ou prompts versionados. A transcrição literal atual não exige credencial
de STT no backend.

## Gates

```bash
pnpm prisma:generate
pnpm test -- --runInBand
pnpm test:e2e
pnpm build
```

O E2E depende de PostgreSQL real. Build ou contagem histórica de testes não prova o fluxo ao vivo;
para mudanças de sessão, valide REST, Socket.IO, reconexão, persistência e permissões.

## Deploy atual documentado

- API: Render ou imagem Docker;
- PostgreSQL: Neon/serviço gerenciado;
- build: instalar, gerar Prisma Client e compilar;
- start: aplicar migrations e iniciar `dist/main`.

A topologia de produção e a capacidade de 50 participantes continuam planejadas até o card de
observabilidade/escala executar os testes correspondentes.
