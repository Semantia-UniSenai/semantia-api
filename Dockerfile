# syntax=docker/dockerfile:1

############################
# Stage 1 — build
############################
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# pnpm via corepack
RUN corepack enable

# Install deps (cached on lockfile change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source, generate Prisma, compile TypeScript and package runtime artifacts
COPY . .
RUN pnpm build

# Drop dev dependencies for a lean runtime node_modules
RUN pnpm prune --prod --ignore-scripts

############################
# Stage 2 — runtime
############################
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Copy production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Apply migrations on boot, then start the server.
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start:prod"]
