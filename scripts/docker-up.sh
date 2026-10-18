#!/usr/bin/env bash
# 로컬 이미지를 빌드하고 컨테이너로 띄운다.
# 사용: scripts/docker-up.sh [up|down|logs]
set -euo pipefail

rewrite_db_host() {
  local value="$1"
  printf '%s' "$value" | sed -E \
    's#(://|@)(localhost|127\.0\.0\.1)([:/])#\1host.docker.internal\3#g'
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  if [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
    export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
    return 0
  fi
  if [[ -x "${HOME}/.docker/bin/docker" ]]; then
    export PATH="${HOME}/.docker/bin:$PATH"
    return 0
  fi
  echo "docker CLI를 찾을 수 없습니다. Docker Desktop을 실행한 뒤 다시 시도하세요." >&2
  exit 1
}

load_env_file() {
  local file="$1"
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${line#*=}"
    if [[ ${#value} -ge 2 && "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ ${#value} -ge 2 && "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    if [[ "$key" == "DATABASE_URL" || "$key" == "DATABASE_DIRECT_URL" ]]; then
      value="$(rewrite_db_host "$value")"
    fi
    export "$key=$value"
  done <"$file"
}

wait_health() {
  local i code
  for i in $(seq 1 30); do
    code="$(
      curl -s -o /tmp/portfolio-api-health.json -w '%{http_code}' \
        --max-time 2 http://127.0.0.1:8080/health || true
    )"
    if [[ "$code" == "200" ]]; then
      echo "health: $(cat /tmp/portfolio-api-health.json)"
      rm -f /tmp/portfolio-api-health.json
      return 0
    fi
    sleep 1
  done
  echo "/health 응답이 없습니다. scripts/docker-up.sh logs 로 확인하세요." >&2
  docker compose logs --tail 40 >&2
  exit 1
}

main() {
  local cmd="${1:-up}"
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$root"
  ensure_docker

  case "$cmd" in
    up)
      if [[ ! -f .env ]]; then
        echo ".env 가 없습니다. DATABASE_URL 을 넣은 뒤 다시 실행하세요." >&2
        exit 1
      fi
      load_env_file .env
      export PORT=8080
      export NODE_ENV=prd
      docker compose up --build --detach --remove-orphans
      wait_health
      ;;
    down)
      docker compose down
      ;;
    logs)
      docker compose logs --tail 80
      ;;
    *)
      echo "사용법: scripts/docker-up.sh [up|down|logs]" >&2
      exit 1
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
