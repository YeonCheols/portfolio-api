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

# 개발 서버 실행
pnpm start:dev
```

## API 문서

API 문서는 Swagger를 통해 제공됩니다. 서버 실행 후 다음 URL에서 확인할 수 있습니다:
```
http://localhost:4000/api
```

## 배포

이 프로젝트는 Vercel을 통해 배포됩니다. `vercel.json` 파일에서 배포 설정을 확인할 수 있습니다.
