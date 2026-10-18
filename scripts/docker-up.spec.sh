#!/usr/bin/env bash
# rewrite_db_host: 컨테이너 안에서 localhost 는 자기 자신이므로 호스트 DB 로 바꾼다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/docker-up.sh"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local name="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $name" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    exit 1
  fi
  echo "ok: $name"
}

assert_eq \
  "$(rewrite_db_host 'postgresql://user:pass@localhost:5432/app')" \
  "postgresql://user:pass@host.docker.internal:5432/app" \
  "localhost host"

assert_eq \
  "$(rewrite_db_host 'postgresql://user:pass@127.0.0.1:5432/app')" \
  "postgresql://user:pass@host.docker.internal:5432/app" \
  "127.0.0.1 host"

assert_eq \
  "$(rewrite_db_host 'postgresql://localhost:5432/app')" \
  "postgresql://host.docker.internal:5432/app" \
  "localhost without user"

assert_eq \
  "$(rewrite_db_host 'postgresql://user:pass@localhost:5432/app?sslmode=require')" \
  "postgresql://user:pass@host.docker.internal:5432/app?sslmode=require" \
  "query string preserved"

assert_eq \
  "$(rewrite_db_host 'postgresql://user:pass@db.example.com:5432/app')" \
  "postgresql://user:pass@db.example.com:5432/app" \
  "remote host unchanged"

if ! grep -q 'portfolio-api:local' "$ROOT/docker-compose.yml"; then
  fail "docker-compose.yml 에 이미지 이름이 없습니다"
fi
if ! grep -q '"8080:8080"' "$ROOT/docker-compose.yml"; then
  fail "docker-compose.yml 에 8080 포트 매핑이 없습니다"
fi
echo "ok: compose image and port"
