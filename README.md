# Portfolio API

이 프로젝트는 NestJS를 사용하여 개발된 포트폴리오 백엔드 API 서버입니다.

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

# 데이터베이스 마이그레이션
pnpm prisma migrate dev

# 프로젝트 빌드
pnpm run build
```

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
