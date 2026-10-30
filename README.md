# Portfolio API

이 프로젝트는 NestJS를 사용하여 개발된 포트폴리오 백엔드 API 서버입니다.
공개하지 않습니다

## 프로젝트 구조

```
portfolio-api/
├── src/                    # 소스 코드 디렉토리
│   ├── main.ts            # 애플리케이션 진입점
│   ├── app.module.ts      # 루트 모듈
│   ├── app.controller.ts  # 루트 컨트롤러
│   ├── app.service.ts     # 루트 서비스
│   ├── prisma/           # Prisma 관련 설정 및 스키마
│   └── project/          # 프로젝트 관련 모듈
├── prisma/               # Prisma 설정 및 마이그레이션 파일
├── test/                # 테스트 파일
├── dist/               # 컴파일된 파일
├── server.js           # 커스텀 서버 설정 (HTTPS 지원)
├── lib/               # 공통 라이브러리
└── node_modules/      # 의존성 패키지
```

## 기술 스택

- NestJS: Node.js 백엔드 프레임워크
- Prisma: ORM(Object-Relational Mapping)
- TypeScript: 정적 타입 지원
- PostgreSQL: 데이터베이스

## 시작하기

### 필수 조건

- Node.js
- pnpm
- PostgreSQL

### 설치

```bash
# 의존성 설치
pnpm install

# 환경 변수 설정
pnpm vercel env pull

# 데이터베이스 스키마 병합 및 적용
pnpm prisma:migrate:deploy

# 프로젝트 빌드
pnpm run build
```

## 데이터베이스 스키마와 마이그레이션

`prisma/models/*.prisma`를 스키마 원본으로 관리합니다. 모델 파일을 수정한 뒤 `pnpm prisma:merge`로 `prisma/schema.prisma`를 생성합니다.

새 migration을 만들 때는 개발 데이터베이스 연결을 설정하고 다음 순서로 실행합니다.

```bash
pnpm prisma:migrate --name <migration_name>
```

Supabase를 포함한 대상 데이터베이스에 커밋된 Prisma migration을 적용하거나 상태를 확인할 때는 다음 명령을 사용합니다.

```bash
pnpm prisma:migrate:status
pnpm prisma:migrate:deploy
```

Prisma는 적용 상태를 대상 DB의 `_prisma_migrations` 테이블에 기록합니다. 이 저장소는 `prisma/migrations`를 사용하며 Supabase CLI의 `supabase_migrations.schema_migrations` 이력은 사용하지 않습니다. `DATABASE_URL`은 애플리케이션 연결에, `DATABASE_DIRECT_URL`은 Prisma migration의 직접 연결에 사용합니다. 배포 워크플로는 migration을 자동 적용하지 않으므로 애플리케이션 배포 전에 대상 DB의 migration 상태를 확인해야 합니다.

Supabase SQL Editor 등에서 migration SQL을 직접 실행했다면 실제 테이블과 Prisma 이력은 별도로 확인해야 합니다. 전체 스키마가 migration과 일치하고 `_prisma_migrations`에 해당 이력이 없을 때만 다음 명령으로 적용 이력을 등록합니다.

```bash
pnpm prisma:migrate:resolve --applied 20261030120000_shared_user_identity
```

이미 `prisma migrate deploy`로 적용한 migration에는 이 명령을 다시 실행하지 않습니다.

`20261030120000_shared_user_identity` migration은 공용 `User`와 외부 로그인 계정을 연결하는 `UserIdentity`를 추가합니다. 현재 GitHub 제공자만 정의하며, 제공자와 외부 사용자 ID 조합을 유일하게 관리하고 각 식별자를 공용 사용자와 외래 키로 연결합니다.

### 공용 OAuth 인증과 토큰 수명주기

수동으로 테이블을 생성한 경우, 실제 스키마가 migration SQL과 일치하고 `_prisma_migrations`에 기록이 없을 때만 아래 명령으로 적용 이력을 등록합니다. DB 연결 환경 변수가 설정되어 있어야 합니다.

```bash
pnpm prisma:migrate:resolve --applied 20261030150000_shared_auth_token_lifecycle
```

이미 `pnpm prisma:migrate deploy`로 적용한 migration에는 다시 실행하지 않습니다.

`POST /auth/authorize`, `/auth/callback`, `/auth/refresh`, `/auth/revoke`는 portfolio와 MCP 서버가 호출하는 공용 인증 API입니다. 요청 본문은 `client_id`를 `portfolio` 또는 `mcp`로 지정하며, 서버 자격 증명은 `PORTFOLIO_AUTH_SERVICE_TOKEN`과 `MCP_AUTH_SERVICE_TOKEN`으로 앱별 분리합니다. 두 앱은 공용 `User`와 GitHub `UserIdentity`를 사용하지만, 각 로그인 세션은 `clientId`, audience, scope로 분리됩니다. 인증 이력과 로그인 세션은 `AuthHistory`에서 관리하고, 발급된 refresh token은 `UserToken`에 토큰 해시 단위로 관리합니다. OAuth state도 인증 흐름의 일부로 `AuthHistory`에 해시와 만료 시각을 저장합니다.

각 앱은 GitHub OAuth client ID/secret, callback URI, 허용 사용자 ID 목록을 별도 환경변수로 설정합니다. portfolio는 `PORTFOLIO_GITHUB_OAUTH_CLIENT_ID`, `PORTFOLIO_GITHUB_OAUTH_CLIENT_SECRET`, `PORTFOLIO_GITHUB_REDIRECT_URI`, `PORTFOLIO_AUTHORIZED_GITHUB_USER_IDS`, `PORTFOLIO_AUTH_AUDIENCE`를 사용합니다. MCP는 기존 `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `MCP_GITHUB_REDIRECT_URI`, `MCP_AUTHORIZED_GITHUB_USER_IDS`, `MCP_RESOURCE_URL`을 사용합니다. API가 발급한 1시간 RS256 액세스 토큰과 30일 refresh token은 앱별 scope(`portfolio:use`, `resume:use`)와 audience에 바인딩됩니다.

OAuth state는 앱 ID와 callback URI에 바인딩해 `AuthHistory`에 해시로 저장하고 한 번만 소비합니다. GitHub OAuth access token은 GitHub API 호출에만 사용하고 저장하지 않습니다. refresh token 원문도 저장하지 않으며 `UserToken`에 해시만 저장합니다. 갱신할 때마다 새 토큰 행을 추가하고 이전 토큰 재사용이 감지되면 해당 인증 이력과 토큰을 폐기합니다. JWT access token은 서명과 만료 시각으로 검증하며 DB에 저장하지 않습니다. 서명 키와 issuer는 `AUTH_PRIVATE_KEY`, `AUTH_ISSUER`로 공용 관리하고, 공개키는 `GET /auth/.well-known/jwks.json`에서 제공합니다. migration `20261030150000_shared_auth_token_lifecycle`을 적용하고 API 배포 환경에 위 변수들을 연결해야 합니다. 이미 발급된 stateless 액세스 토큰은 폐기 후에도 최대 1시간 유효할 수 있습니다.

### 환경 변수 (메일 발송)

다음 환경 변수를 설정해 메일 발송 기능을 사용합니다.

```
RESEND_API_KEY=your_resend_api_key
MAIL_FROM=Your Name <onboarding@resend.dev>
MAIL_TO=s9292909@gmail.com
```

Swagger에서 `POST /public/mail/send` 엔드포인트를 호출할 수 있습니다.

### 서버 실행

#### 기본 HTTP 서버

```bash
# 개발 서버 실행
pnpm start:dev

# 프로덕션 서버 실행
pnpm start:prod
```

#### 커스텀 HTTPS 서버 (server.js)

```bash
# HTTPS 서버 실행 (개발 환경)
pnpm run start:https

# HTTPS 서버 실행 (프로덕션 환경)
pnpm run start:https:prod
```

**참고**: HTTPS 서버를 사용하려면 `cert/` 디렉토리에 다음 인증서 파일이 필요합니다:

- `cert/local.po.pem` (개인키)
- `cert/cert.pem` (인증서)

인증서 파일이 없는 경우 자동으로 HTTP 서버로 대체됩니다.

## API 문서

API 문서는 Swagger를 통해 제공됩니다. 서버 실행 후 다음 URL에서 확인할 수 있습니다:

```
http://localhost:4000/api
https://local.ycseng.com:4000/api (HTTPS 서버 사용 시)
```

## 배포

이 프로젝트는 Vercel을 통해 배포됩니다. `vercel.json` 파일에서 배포 설정을 확인할 수 있습니다.
