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

FROM node:22-bookworm-slim AS runtime

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
