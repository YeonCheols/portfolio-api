# AGENTS.md

이 파일은 `portfolio-api` 저장소에서 작업하는 AI 에이전트를 위한 지침입니다.

## 프로젝트 개요

- NestJS 11 + Prisma 6 (PostgreSQL) 기반 포트폴리오 백엔드 API
- 패키지 매니저: **pnpm** (npm/yarn 사용 금지)
- 배포: Vercel (`vercel.json`), `master` 푸시 시 GitHub Actions가 태그/릴리스 생성
- 응답 언어: 사용자에게는 **한국어**로 답변

## 디렉토리 구조

```
src/
├── main.ts / app.module.ts
├── prisma/                 # PrismaService, PrismaModule
├── enum/
└── apps/
    ├── admin/<domain>/     # 관리자 API (JWT 인증), auth 포함
    │   ├── dto/            # *-create/update/get/search.dto.ts + index.ts
    │   ├── <domain>.controller.ts
    │   ├── <domain>.service.ts
    │   └── <domain>.module.ts
    └── public/<domain>/    # 공개 API
prisma/                     # 분할 스키마 + merge-schema.js + migrations
test/                       # e2e 테스트 (*.e2e-spec.ts)
.agents/skills/             # 공통 에이전트 스킬 (원본)
.cursor/skills/             # Cursor용 심볼릭 링크 → .agents/skills/*
```

## 주요 명령어

| 목적 | 명령어 |
|------|--------|
| 개발 서버 | `pnpm start:dev` |
| 빌드 | `pnpm build` |
| 린트 (자동 수정) | `pnpm lint` |
| 포맷 | `pnpm format` |
| 단위 테스트 | `pnpm test` / `pnpm test -- <경로>` |
| 커버리지 | `pnpm test:cov` |
| e2e 테스트 | `pnpm test:e2e` |
| Prisma 스키마 병합+생성 | `pnpm prisma:generate` |
| 마이그레이션 | `pnpm prisma:migrate` |

## 코딩 컨벤션

- Prettier: 큰따옴표, 세미콜론, trailing comma `all`, 80자, 2칸 들여쓰기
- import는 절대경로 `src/...` 사용 (예: `import { PrismaService } from "src/prisma/prisma.service"`)
- DTO 클래스명: `<Scope><Domain><Action>Request|Response` (예: `AdminTagSearchRequest`)
- DTO는 `dto/index.ts`에서 re-export
- 검증은 `class-validator`, 문서화는 `@nestjs/swagger` 데코레이터 사용
- 서비스는 `PrismaService`를 주입받아 사용, 없는 리소스는 `NotFoundException` 등 Nest 내장 예외로 처리
- Prisma 스키마 수정 시 `prisma/` 분할 파일을 수정한 뒤 `pnpm prisma:generate`

## 안전 규칙

- `.env`, `.env.local`, `cert/`, `.vercel/` 내용을 커밋하거나 출력하지 않는다
- `master` 브랜치에 직접 커밋/푸시하지 않는다 (작업 브랜치는 `dev` 또는 기능 브랜치)
- `git push --force`, `git reset --hard`, 마이그레이션 삭제 등 파괴적 작업은 사용자 확인 후에만 수행
- 사용자가 요청하지 않은 커밋/푸시/PR 생성은 하지 않는다

## 에이전트 스킬

모든 에이전트(Cursor, Claude Code, Codex 등)가 공통으로 사용하는 스킬은 `.agents/skills/<skill-name>/SKILL.md`에 있습니다. `.cursor/skills/`의 항목은 같은 파일을 가리키는 심볼릭 링크입니다.

### 필수 규칙

아래 작업을 할 때는 **반드시** 해당 `SKILL.md`를 먼저 읽고 그 절차를 그대로 따릅니다. 사용자가 스킬 이름을 언급하지 않아도 적용하며, 생략하거나 임의의 방식으로 대체하지 않습니다.

1. **코드 수정 → `tdd` 스킬 필수**
   - `src/`, `test/`, `prisma/`, `utils/`의 코드(기능 추가, 버그 수정, 리팩터링)를 수정할 때는 항상 `tdd` 스킬로 진행한다
   - 실패하는 테스트를 먼저 작성하고 실패를 확인한 뒤에 구현 코드를 수정한다
   - 코드를 수정하면 관련 파일의 테스트 코드도 반드시 추가하거나 수정한다 (구현만 바뀐 상태로 끝내지 않음)
   - 문서(`*.md`)나 설정만 바꾸는 경우는 예외지만, 그 판단 근거를 사용자에게 알린다
2. **커밋 → `commit` 스킬 필수**
   - 모든 커밋은 `commit` 스킬의 절차(검토 → 검증 → 선별 스테이징 → 메시지 형식)로만 수행한다
3. **PR 생성 → `pr` 스킬 필수**
   - 모든 PR은 `pr` 스킬의 절차와 PR 템플릿 형식으로만 생성한다
   - PR 담당자(assignee)는 반드시 현재 `gh`에 로그인된 활성 GitHub 계정으로 지정한다

### 스킬 목록

| 스킬 | 경로 | 사용 시점 |
|------|------|-----------|
| `tdd` | `.agents/skills/tdd/SKILL.md` | **코드를 수정할 때 항상** |
| `commit` | `.agents/skills/commit/SKILL.md` | **커밋할 때 항상** |
| `pr` | `.agents/skills/pr/SKILL.md` | **PR을 생성할 때 항상** |
| `qa` | `.agents/skills/qa/SKILL.md` | 작업 완료 전 검증, 커밋/PR 직전, "QA 해줘" 요청 시 |

일반적인 작업 흐름: `tdd` → `qa` → `commit` → `pr`

새 스킬 추가 방법:

```bash
mkdir -p .agents/skills/<kebab-case-name>   # SKILL.md 작성
ln -s ../../.agents/skills/<kebab-case-name> .cursor/skills/<kebab-case-name>
```

그다음 위 표에 등록합니다. 스킬 수정은 항상 `.agents/skills/` 원본에서 합니다.
