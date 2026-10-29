#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export DATABASE_URL="postgresql://test:test@127.0.0.1:54329/portfolio_test"
export DATABASE_DIRECT_URL="$DATABASE_URL"
export JWT_SECRET="integration-test-jwt-secret"

docker compose -f docker-compose.test.yml up -d --wait
pnpm exec prisma migrate deploy
pnpm exec jest --config ./test/jest-e2e.json --runInBand --forceExit --ci
