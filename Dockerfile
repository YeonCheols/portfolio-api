FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV CI=true

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
ARG DATABASE_URL=postgresql://user:pass@localhost:5432/app
ARG DATABASE_DIRECT_URL=postgresql://user:pass@localhost:5432/app
ENV DATABASE_URL=$DATABASE_URL
ENV DATABASE_DIRECT_URL=$DATABASE_DIRECT_URL
RUN pnpm build

FROM node:22-bookworm-slim AS app

WORKDIR /app
ENV NODE_ENV=prd

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

USER node
EXPOSE 8080
CMD ["node", "dist/src/main.js"]

# 로컬 컨테이너(docker compose)용: 환경변수는 .env로 받는다.
FROM app AS local

# 운영용: 시작할 때 portfolio-config로 정적 환경변수를 읽는다.
# configcli 빌드 컨텍스트에는 portfolio-config 바이너리가 있어야 한다(deploy.yml이 준비한다).
FROM app AS runtime
USER root
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends curl gnupg \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update -y \
  && apt-get install -y --no-install-recommends gh \
  && apt-get purge -y --auto-remove curl gnupg \
  && rm -rf /var/lib/apt/lists/*
COPY --from=configcli /portfolio-config /usr/local/bin/portfolio-config
COPY --from=build /app/scripts/start-with-config.sh ./scripts/start-with-config.sh
USER node
ENTRYPOINT ["sh", "scripts/start-with-config.sh"]
CMD ["node", "dist/src/main.js"]
