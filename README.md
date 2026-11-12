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

`20261102090000_mcp_oauth_protocol` migration은 `AuthHistory`에 OAuth client, redirect URI, client state, PKCE challenge 컬럼과 조회 인덱스를 추가하며, 운영 DB 스키마에 반영되었습니다. Prisma migration 이력 기록 여부는 `pnpm prisma:migrate:status`로 확인합니다. SQL Editor 등에서 스키마만 수동 반영했고 `_prisma_migrations`에 이력이 없다면 실제 스키마가 migration SQL과 일치하는지 확인한 뒤에만 `pnpm prisma:migrate:resolve --applied 20261102090000_mcp_oauth_protocol`로 이력을 등록합니다. 이미 `migrate deploy`로 기록된 경우 이 명령을 다시 실행하지 않습니다.

MCP 클라이언트용 표준 OAuth endpoint는 `GET /.well-known/oauth-authorization-server/auth`, `POST /auth/register`, `GET /auth/authorize`, `GET /auth/github/callback`, `POST /auth/token`, `POST /auth/oauth/revoke`입니다. authorization code는 PKCE S256, 등록 redirect URI, resource, scope에 바인딩하고 `AuthHistory`에서 state와 code 소비를 관리합니다. 공개 client ID는 서버 비밀값으로 서명하며 GitHub client secret과 서비스 자격 증명을 공개하지 않습니다. Access token이 1시간 후 만료되면 OAuth client가 refresh grant를 요청하고, portfolio-api가 refresh token을 회전해 새 access/refresh token을 발급합니다. MCP 서버는 refresh token을 보유하거나 갱신하지 않습니다.

기존 `POST /auth/authorize`, `/auth/callback`, `/auth/refresh`, `/auth/revoke`는 portfolio와 MCP 서버가 호출하는 인증 API로 유지합니다. 요청 본문 `client_id=mcp`는 기존 `MCP_AUTH_SERVICE_TOKEN`으로 검사하고, `client_id=portfolio`는 공통 OAuth client가 발급받은 `auth:manage` access token으로 검사합니다. `PORTFOLIO_AUTH_SERVICE_TOKEN`은 더 이상 읽거나 인증에 사용하지 않습니다. 로그인 시작 전에도 호출할 수 있도록 사용자 access token 대신 서버용 client_credentials 토큰을 사용합니다. `POST /auth/introspect`는 기존대로 MCP 서비스 토큰이 있는 MCP 서버만 호출하며, 전달된 사용자 access token의 JWT claim과 연결된 `AuthHistory` 상태를 확인해 현재 유효성(`active`)을 반환합니다. 두 앱은 공용 `User`와 GitHub `UserIdentity`를 사용하지만, 각 로그인 세션은 `clientId`, audience, scope로 분리됩니다. 인증 이력과 로그인 세션은 `AuthHistory`에서 관리하고, 발급된 refresh token은 `UserToken`에 토큰 해시 단위로 관리합니다.

각 앱은 GitHub OAuth client ID/secret, callback URI, 허용 사용자 ID 목록을 별도 환경변수로 설정합니다. portfolio는 `PORTFOLIO_GITHUB_OAUTH_CLIENT_ID`, `PORTFOLIO_GITHUB_OAUTH_CLIENT_SECRET`, `PORTFOLIO_GITHUB_REDIRECT_URI`, `PORTFOLIO_AUTHORIZED_GITHUB_USER_IDS`, `PORTFOLIO_AUTH_AUDIENCE`를 사용합니다. MCP는 `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `MCP_GITHUB_REDIRECT_URI`, `MCP_AUTHORIZED_GITHUB_USER_IDS`, `MCP_RESOURCE_URL`을 사용합니다. MCP OAuth를 API가 직접 제공하도록 전환할 때 `MCP_GITHUB_REDIRECT_URI`와 GitHub OAuth App callback을 `https://api.ycseng.com/auth/github/callback`으로 맞춰야 합니다. API가 발급한 1시간 RS256 액세스 토큰과 30일 refresh token은 앱별 scope(`portfolio:use`, `resume:use`)와 audience에 바인딩됩니다.

OAuth state는 앱 ID와 callback URI에 바인딩해 `AuthHistory`에 해시로 저장하고 한 번만 소비합니다. GitHub OAuth access token은 GitHub API 호출에만 사용하고 저장하지 않습니다. refresh token 원문도 저장하지 않으며 `UserToken`에 해시만 저장합니다. 갱신할 때마다 새 토큰 행을 추가하고 이전 토큰 재사용이 감지되면 해당 인증 이력과 토큰을 폐기합니다. JWT access token은 서명과 만료 시각으로 검증하며 DB에 저장하지 않습니다. 서명 키와 issuer는 `AUTH_PRIVATE_KEY`, `AUTH_ISSUER`로 공용 관리하고, 공개키는 `GET /auth/.well-known/jwks.json`에서 제공합니다. issuer가 `https://api.ycseng.com/auth`이면 OAuth discovery metadata 경로는 RFC 8414에 따라 `https://api.ycseng.com/.well-known/oauth-authorization-server/auth`입니다. MCP 서버는 각 요청에서 bearer access token을 `/auth/introspect`에 보내고 API는 JWT와 활성·폐기 상태를 확인합니다. 두 migration의 운영 DB 스키마는 반영되었으며, 적용 이력은 `pnpm prisma:migrate:status`로 확인합니다. API 및 MCP 런타임에는 위 변수를 연결해야 합니다. 이미 발급된 stateless 액세스 토큰은 introspection이 없이는 폐기 후에도 최대 1시간 유효할 수 있습니다.

### 관리자 OAuth 로그인 (Google, GitHub)

관리자 앱(portfolio-admin)이 Google 또는 GitHub로 로그인하는 관리자 전용 엔드포인트입니다. 공용 사용자 토큰(`auth/*`)과 별개이며, 로그인에 성공하면 이메일·비밀번호 로그인(`POST admin/user/login`)과 같은 관리자 토큰(`access_token` 쿠키, 1일)을 발급하므로 `admin/*` API의 인증 계약은 바뀌지 않습니다.

| 엔드포인트 | 설명 |
| --- | --- |
| `GET admin/auth/oauth/:provider/authorize` | 일회용 state를 만들고 공급자 로그인 화면으로 302 이동합니다. `provider`는 `google` 또는 `github`입니다 |
| `GET admin/auth/oauth/:provider/callback` | state를 소비하고 코드를 교환합니다. 성공하면 쿠키를 심고 관리자 앱 `/`로, 실패하면 `/login?error=<코드>`로 302 이동합니다 |

- 관리자 판정: 공급자가 **검증한 이메일**이 활성 `AdminUser.email`과 같을 때만 허용합니다(대소문자 무시). Google은 `email_verified`, GitHub는 `user:email` 범위로 조회한 기본·검증된 이메일을 씁니다
- 거절 코드: `ACCESS_DENIED`(미등록·비활성·미검증 이메일, 공급자 거절), `AUTH_FAILED`(잘못되었거나 만료·재사용된 state, 코드 교환 실패). 공급자 오류 원문과 토큰은 응답·로그·주소에 싣지 않습니다
- 복귀 경로는 관리자 앱의 `/`와 `/login`으로 고정하며 요청 값을 쓰지 않습니다
- 로그인 CSRF 방지: `authorize`가 state를 담은 단기 쿠키(`admin_oauth_state`, httpOnly·secure·SameSite=Lax, 10분)를 시작한 브라우저에 심고 `callback`이 요청의 state와 대조합니다. 결과와 상관없이 콜백에서 지웁니다
- 비활성화된 관리자(`isActive=false`)는 OAuth 로그인뿐 아니라 이미 발급된 토큰으로도 `admin/*`에 접근할 수 없습니다
- 환경 변수:

| 변수 | 설명 |
| --- | --- |
| `ADMIN_APP_URL` | 관리자 앱 주소(예: `https://admin.ycseng.com`). 결과 리다이렉트의 기준입니다 |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client |
| `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | MCP와 공용 GitHub 앱. 콜백 URL 목록에 `{AUTH_ISSUER의 origin}/admin/auth/oauth/github/callback`을 등록합니다 |

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

### 모델 API 키 저장 migration 적용 현황

2026-11-03 운영 Cloud Run `portfolio-api`가 사용하는 DB에 `20261103080606_add_resume_model_api_key`를 적용했습니다.

- `ResumeModelSetting.apiKey` nullable TEXT 컬럼을 추가했습니다. 실제 키와 모델 메타데이터는 portfolio-api가 관리합니다.
- 기존 `secretRef` 컬럼은 데이터 보존을 위해 nullable로 유지하며 새 런타임 계약에서는 사용하지 않습니다.
- 운영 스키마를 임시 로컬 DB의 전체 migration 결과와 읽기 전용으로 대조했습니다. 기존 인증 변경은 이미 존재하고 이번 모델 키 변경만 차이인 것을 확인했습니다.
- `20261030150000_shared_auth_token_lifecycle`과 `20261102090000_mcp_oauth_protocol`은 SQL 재실행 없이 `prisma migrate resolve --applied`로 누락 이력만 정합화했습니다.
- 새 모델 키 migration은 `prisma migrate deploy`로 적용했으며 당시 16개 migration이 모두 최신 상태인 것을 확인했습니다. `_prisma_migrations`를 SQL로 직접 수정하지 않았습니다.
- 기존 모델의 실제 API 키는 자동 입력하지 않았습니다. 키가 들어간 새 비활성 설정을 등록한 뒤 활성화해야 합니다. 키가 없는 설정은 활성화와 런타임 조회를 거부합니다.
- 이 기록은 DB 적용 완료를 의미합니다. 새 API 코드와 MCP 화면·런타임의 배포 완료를 의미하지 않습니다.

저장·수정·목록·런타임 조회 JSON 계약은 [모델 설정 API 문서](MODEL_SETTING_API.md)를 따릅니다.

### 모델 공급자 enum migration 적용 현황

2026-11-04 운영 Cloud Run `portfolio-api`가 사용하는 DB에 `20261104001202_add_openai_gemini_providers`를 `pnpm prisma:migrate:deploy`로 적용했습니다.

- `ResumeModelProvider` enum에 `openai`와 `gemini`를 추가했습니다. 기존 `openrouter` 값과 설정 데이터는 변경하지 않습니다.
- 적용 전 기존 16개 migration이 완료되어 있고 이번 migration 하나만 미적용인 것을 확인했습니다.
- 적용 후 실제 enum 값이 `openrouter`, `openai`, `gemini`이며 전체 17개 migration이 최신 상태인 것을 확인했습니다.
- `_prisma_migrations`의 적용 완료 상태와 SQL checksum이 커밋된 migration 파일과 일치하는지 확인했습니다. 이력 테이블을 SQL로 직접 수정하거나 `migrate resolve`를 실행하지 않았습니다.
- 이 기록은 운영 DB의 DDL과 Prisma 이력 반영 완료를 의미합니다. 기록 시점에 OpenAI·Gemini를 허용하는 API 코드와 MCP 어댑터·화면의 배포는 별도 단계로 남아 있습니다.

적용 명령과 배포 순서는 [모델 설정 API 문서](MODEL_SETTING_API.md#운영-migration-적용-현황)를 따릅니다.

## 공통 프로젝트 서비스 API

Hub, `portfolio2/mcp` 등 서버 측 호출자는 같은 OAuth 서비스 자격과 프로젝트 쓰기 API를 사용합니다. 기존 사용자 OAuth 로그인은 유지합니다. 이 기능은 별도 Prisma 컬럼이나 migration을 추가하지 않습니다.

### 설정과 토큰 발급

배포 환경의 `portfolio-config`에 다음 값을 등록해야 합니다. 실제 자격 값은 코드나 공개 문서에 넣지 않습니다.

- `SERVICE_OAUTH_CLIENT_ID`: 공통 프로젝트 서비스 client 식별자입니다.
- `SERVICE_OAUTH_CLIENT_SECRET`: 공통 서비스 client의 비밀값입니다.
- `SERVICE_OAUTH_AUDIENCE`: 프로젝트 서비스 토큰의 audience입니다.
- 기존 `AUTH_ISSUER`와 `AUTH_PRIVATE_KEY`를 그대로 사용합니다.

`POST /auth/token`에 `grant_type=client_credentials`와 필요한 scope를 전달합니다. 프로젝트 쓰기는 `project:write`, 비MCP 서버의 인증 처리 API는 `auth:manage`를 사용합니다. scope를 생략하면 기존 계약대로 `project:write`입니다. 두 권한은 서로 대체할 수 없으며 사용자 OAuth scope인 `resume:use` 등은 이 grant로 발급하지 않습니다. 권장 client 인증은 HTTP Basic이며 ID와 secret을 form 인코딩한 뒤 `ID:SECRET`을 base64 인코딩합니다. 본문의 `client_id`, `client_secret`을 사용하는 `client_secret_post`도 지원하며 두 방식을 동시에 보내면 거부합니다. 자격 증명은 서버 또는 Actions의 비밀 설정에서만 사용합니다.

응답은 `access_token`, `token_type: Bearer`, `expires_in: 900`, `scope`는 요청한 `project:write` 또는 `auth:manage`입니다. 사용자 로그인과 refresh token은 필요하지 않으며 실행마다 새 토큰을 발급받습니다. 기존 `AuthHistory`에 사용자 없이 서비스 세션을 기록하고 서명·issuer·audience·scope·만료·활성 세션을 함께 검증합니다. client 자격이 미설정이면 서비스 토큰 발급을 거부합니다.

### 생성·업데이트

`PUT /service/project`에 서비스 access token을 Bearer로 전달합니다. 요청은 다음 필드를 사용합니다.

- `slug`: 기존 프로젝트 식별자이며 같은 값이면 업데이트하고 없으면 생성합니다.
- `title`, `description`, `image`, `stacks`, `content`: 전체 콘텐츠를 전달합니다. `stacks`는 기존 API와 같은 JSON 문자열 배열이며 `content`는 자유 형식 마크다운입니다.
- `linkDemo`, `linkGithub`: 선택적인 HTTP(S) 링크입니다. 생략하거나 null로 전달하면 기존 링크를 지웁니다.

마크다운의 제목·목차·front matter·필수 항목은 요구하지 않습니다. 각 저장소가 `PROJECT.MD`를 관리하고 Hub나 MCP가 이를 읽거나 AI로 보완해 API 전송 필드로 구성합니다. API는 GitHub 조회와 AI 생성을 수행하지 않습니다.

생성·업데이트는 즉시 공개하며 기존 관리자 편집 내용도 요청 내용으로 교체합니다. `isShow`, `order`, 저장소 ID 등 계약 밖의 필드를 전달하면 거부합니다. 신규는 기존 order 기본값을 사용하고 기존 프로젝트의 order는 유지합니다. 프로젝트와 스택 태그 관계를 같은 트랜잭션으로 반영하며, 같은 콘텐츠와 태그를 재전송하면 쓰기와 updatedAt 갱신을 생략합니다. 충돌은 제한적으로 재시도하고 계속 충돌하면 409, 그 외 저장 장애는 고정 메시지의 503으로 반환합니다.

응답은 `operation: created | updated | unchanged`와 `project`입니다. 네트워크 응답을 잃은 경우 같은 slug와 콘텐츠를 재전송할 수 있습니다. 여러 호출자가 서로 다른 내용을 같은 slug에 쓰면 마지막으로 성공한 요청이 반영되며 과거 요청의 버전 순서까지 보장하지는 않습니다.

### 최근 변경 표시

공개 목록·검색·상세·태그별 조회와 서비스 저장 응답의 프로젝트에 `isRecent`를 제공합니다. 기존 updatedAt부터 응답 시각까지 0 이상 7일 이하이면 true이며 정확히 7일을 포함하고 미래 시각은 제외합니다. 생성과 업데이트를 별도로 구분하지 않으며 기존 프로젝트의 목록 순서는 변경하지 않습니다. 실제 Hub 콘텐츠 변경 시 updatedAt을 명시적으로 갱신하고 동일 콘텐츠 재전송으로 최근 표시 기간을 늘리지 않습니다.

### 비MCP 고정 서비스 토큰 제거

비MCP 서버 호출은 별도 고정 Bearer token을 공유하지 않고 기존 공통 OAuth 자격으로 `auth:manage` access token을 발급받습니다. 새로운 client ID·secret이나 만료 없는 서비스 토큰을 앱마다 추가하지 않습니다. `SERVICE_OAUTH_CLIENT_ID`, `SERVICE_OAUTH_CLIENT_SECRET`, `SERVICE_OAUTH_AUDIENCE`와 기존 서명 키·issuer를 그대로 재사용하고, 15분 만료·서명·audience·scope·활성/폐기 이력을 검증합니다.

프로젝트 API는 계속 `project:write`만 허용하며 Hub의 요청 방식은 바뀌지 않습니다. `MCP_AUTH_SERVICE_TOKEN`, `RESUME_MODEL_SETTING_TOKEN`과 이를 사용하는 MCP의 로그인·introspection·모델 설정 경로는 유지합니다. MCP OAuth client ID 서명에 사용하는 기존 키도 변경하지 않습니다. 사용자 OAuth authorization_code·PKCE·refresh token 흐름과 DB 스키마도 변경하지 않습니다.

API 코드에서 이전 portfolio 고정 토큰은 인증되지 않습니다. 구형 portfolio 서버 호출자가 있다면 먼저/함께 client_credentials와 `auth:manage`로 전환해야 합니다. 정적 설정 원본의 폐기된 키 정리는 portfolio-config의 별도 작업이며, 이 변경만으로 운영 설정값이나 배포를 수정하지 않습니다.
