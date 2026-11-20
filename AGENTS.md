# AGENTS.md

이 파일은 `portfolio-api` 저장소에서 작업하는 AI 에이전트를 위한 지침의 **원본**입니다. 어떤 에이전트든 작업을 시작하기 전에 이 파일 전체를 읽고, 아래 [필수 규칙](#필수-규칙)의 스킬을 따릅니다.

## 프로젝트 개요

- NestJS 11 + Prisma 6 (PostgreSQL) 기반 포트폴리오 백엔드 API
- 패키지 매니저: **pnpm** (npm/yarn 사용 금지)
- 배포: `master` 푸시 시 GitHub Actions가 Cloud Run에 배포하고 태그/릴리스를 생성한다. `vercel.json`은 저장소에 남아 있다
- CI: `master`/`dev` 대상 PR마다 `.github/workflows/ci.yml`이 `lint:check`, `format:check`, `typecheck`, `test:cov` 실행 (비공개 Free 플랜이라 브랜치 보호로 머지를 막을 수 없으므로, PR 머지 전 CI 통과 확인은 `pr` 스킬 절차로 강제)
- AI 리뷰: `.github/workflows/ai-review.yml`은 PR 댓글 `/review`로만 실행한다. PR 생성·푸시 자동 실행은 꺼 두었다 (`CURSOR_API_KEY` secret 필요, 체크는 실패시키지 않음)
- 응답 언어: 사용자에게는 **한국어**로 답변한다. 한국어 문장은 표준 문장체인 `습니다`/`ㅂ니다`로 끝낸다. 이슈 제목과 본문도 같은 어미로 끝낸다. `다`로 끝내지 않고, 한 이슈 안에서 어미를 섞지 않는다. 이슈 본문은 `issue` 스킬을 따른다. 코드, 식별자, 커밋 제목처럼 문장이 아닌 표기는 제외한다.

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
.claude/skills/             # Claude Code용 심볼릭 링크 → .agents/skills/*
```

## 주요 명령어

| 목적 | 명령어 |
|------|--------|
| 개발 서버 | `pnpm start:dev` |
| 빌드 | `pnpm build` |
| 타입 검사 (Vercel 동일 조건) | `pnpm typecheck:vercel` |
| 린트 (자동 수정) | `pnpm lint` |
| 린트 검사 (CI) | `pnpm lint:check` |
| 포맷 | `pnpm format` |
| 포맷 검사 (CI) | `pnpm format:check` |
| 타입 검사 (CI) | `pnpm typecheck` |
| 단위 테스트 | `pnpm test` / `pnpm test -- <경로>` |
| 커버리지 | `pnpm test:cov` |
| e2e 테스트 | `pnpm test:e2e` |
| 통합 테스트 | `pnpm test:integration` |
| Prisma 스키마 병합+생성 | `pnpm prisma:generate` |
| 개발 migration 생성 | `pnpm prisma:migrate --name <migration_name>` |
| migration 상태 확인 | `pnpm prisma:migrate:status` |
| 대상 DB migration 적용 | `pnpm prisma:migrate:deploy` |
| 수동 반영 이력 정합화 | `pnpm prisma:migrate:resolve --applied <migration_name>` |

## 코딩 컨벤션

- Prettier: 큰따옴표, 세미콜론, trailing comma `all`, 80자, 2칸 들여쓰기
- import는 절대경로 `src/...` 사용 (예: `import { PrismaService } from "src/prisma/prisma.service"`)
- DTO 클래스명: `<Scope><Domain><Action>Request|Response` (예: `AdminTagSearchRequest`)
- DTO는 `dto/index.ts`에서 re-export
- 검증은 `class-validator`, 문서화는 `@nestjs/swagger` 데코레이터 사용
- 서비스는 `PrismaService`를 주입받아 사용, 없는 리소스는 `NotFoundException` 등 Nest 내장 예외로 처리
- Prisma 스키마를 변경하거나 새 모델을 추가할 때는 `prisma/models/*.prisma`를 수정하고 `pnpm prisma:migrate --name <migration_name>`으로 대응 migration을 생성해야 합니다. `prisma/schema.prisma`는 병합 산출물이므로 직접 수정하지 않으며, 스키마 변경은 migration SQL과 함께 커밋해야 합니다
- Prisma CLI는 대상 DB의 `_prisma_migrations`에 적용 이력을 자동 기록하므로 이 테이블을 SQL로 직접 수정하지 않습니다. Supabase SQL Editor 등에서 migration SQL을 수동 적용한 경우에는 실제 스키마와 migration 결과가 일치하는지 확인한 뒤 `pnpm prisma:migrate:resolve --applied <migration_name>`으로 이력을 정합화합니다
- 대상 DB의 migration 상태는 `pnpm prisma:migrate:status`로 확인하고, 커밋된 migration 적용은 `pnpm prisma:migrate:deploy`로 수행합니다. 이 저장소는 Supabase CLI migration history 대신 Prisma migration history를 사용합니다
- Prisma 스키마 변경 후에는 `pnpm prisma:generate`와 관련 스키마 테스트를 실행합니다

## 안전 규칙

- 코드 수정은 대응 이슈 번호가 포함된 작업 브랜치(예: `feat/120-project-source`)에서만 수행합니다. 수정 전에 관련 이슈와 현재 브랜치를 확인하며, 다른 이슈 브랜치에서 작업을 시작하지 않습니다

- `.env`, `.env.local`, `cert/`, `.vercel/` 내용을 커밋하거나 출력하지 않는다
- `master` 브랜치에 직접 커밋/푸시하지 않는다 (작업 브랜치는 `dev` 또는 기능 브랜치)
- `master`를 기준으로 브랜치를 만들거나 병합·비교·PR 베이스로 쓸 때는 먼저 `git fetch origin`으로 `origin/master` 최신을 받은 뒤 그 커밋을 쓴다. 로컬 `master`가 뒤처져 있으면 그 브랜치를 기준으로 삼지 않는다.
- `git push --force`, `git reset --hard`, 마이그레이션 삭제 등 파괴적 작업은 사용자 확인 후에만 수행
- 사용자가 요청하지 않은 커밋/푸시/PR/이슈 생성은 하지 않는다
- 이슈는 사용자가 닫으라고 하기 전에는 닫지 않는다. `Fixes`, `Closes`, `Resolves`와 `gh issue develop`는 머지 때 이슈를 닫으므로 쓰지 않는다. 관련 이슈는 `#번호`만 적는다

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
   - 모든 커밋은 `commit` 스킬의 절차(검토 → 검증 → 선별 스테이징 → 코드 리뷰 → 메시지 형식)로만 수행한다
   - 코드 변경 커밋은 직전에 `review` 스킬(staged)을 실행하고, 🔴 항목이 있으면 커밋하지 않고 보고한다
3. **PR 생성 → `pr` 스킬 필수**
   - 모든 PR은 `pr` 스킬의 절차와 PR 템플릿 형식으로만 생성한다
   - PR 담당자(assignee)는 반드시 현재 `gh`에 로그인된 활성 GitHub 계정으로 지정한다
   - PR 생성 후 `review` 스킬(branch) 결과를 PR 댓글로 남기고, 최신 리뷰에 🔴 항목이 남아 있으면 머지하지 않는다
4. **코드 리뷰 기준 → `review` 스킬**
   - 로컬 리뷰와 CI `/review`(`.github/workflows/ai-review.yml`)는 모두 `review` 스킬의 관점·심각도를 따르고, 댓글 본문은 `.agents/skills/review/TEMPLATE.md`만 채운다. 발견마다 TDD 근거가 있어야 한다. 리뷰 기준은 이 스킬에서만 수정한다
5. **이슈 생성 → `issue` 스킬 필수**
   - 모든 이슈는 `issue` 스킬과 `.github/ISSUE_TEMPLATE.md`로만 만든다. 상태는 `@NoCode_Build`의 Status이고 값은 `ToDo`, `In Progress`, `Review`, `Done`만 쓴다. 새 이슈는 `ToDo`다. 라벨로 상태를 만들지 않는다
   - 예상, 변경범위, 코드, 1급 시민, 불변조건, TDD 기준 테스트 조건은 목록이다. 테스트 조건을 빼거나 뒤로 미루지 않는다
   - 제목과 본문 문장은 `습니다`/`ㅂ니다`로 끝낸다. `다`로 끝내지 않는다

### 스킬 목록

| 스킬 | 경로 | 사용 시점 |
|------|------|-----------|
| `tdd` | `.agents/skills/tdd/SKILL.md` | **코드를 수정할 때 항상** |
| `commit` | `.agents/skills/commit/SKILL.md` | **커밋할 때 항상** |
| `pr` | `.agents/skills/pr/SKILL.md` | **PR을 생성할 때 항상** |
| `qa` | `.agents/skills/qa/SKILL.md` | 작업 완료 전 검증, 커밋/PR 직전, "QA 해줘" 요청 시 |
| `review` | `.agents/skills/review/SKILL.md` | **커밋 직전(staged), PR 생성 직후(branch), CI `/review`**, "리뷰 해줘" 요청 시 |
| `usage` | `.agents/skills/usage/SKILL.md` | "사용량", "남은 한도" 확인 요청 시 (Cursor 플랜 %, ai-review 실행 기록) |
| `issue` | `.agents/skills/issue/SKILL.md` | **이슈를 만들 때 항상**. 본문은 `.github/ISSUE_TEMPLATE.md` |

일반적인 작업 흐름: 이슈가 필요하면 `issue` → `tdd` → `qa` → `commit`(→ `review` staged) → `pr`(→ `review` branch 댓글) → CI(`ci`) → 체크 통과·🔴 해소 확인 후 머지. CI 리뷰는 PR 댓글 `/review`로만 실행한다

새 스킬 추가 방법:

```bash
mkdir -p .agents/skills/<kebab-case-name>   # SKILL.md 작성
ln -s ../../.agents/skills/<kebab-case-name> .cursor/skills/<kebab-case-name>
ln -s ../../.agents/skills/<kebab-case-name> .claude/skills/<kebab-case-name>
```

그다음 위 표에 등록합니다. 스킬 수정은 항상 `.agents/skills/` 원본에서 합니다.

## 에이전트별 진입점

에이전트마다 자동으로 읽는 파일이 달라서, 각 도구가 이 파일(`AGENTS.md`)로 오도록 진입점 파일을 둡니다. 진입점 파일에는 내용을 늘리지 않고, 지침은 항상 이 파일에서 수정합니다.

| 에이전트 | 자동으로 읽는 파일 | 스킬 위치 |
|----------|-------------------|-----------|
| Cursor | `AGENTS.md`, `.cursor/rules/agents.mdc` (항상 적용) | `.cursor/skills/` |
| Codex | `AGENTS.md` | `.agents/skills/` |
| Claude Code | `CLAUDE.md` (`@AGENTS.md` 포함) | `.claude/skills/` |
| Gemini CLI | `GEMINI.md` (`@AGENTS.md` 포함) | `.agents/skills/` |
| GitHub Copilot | `.github/copilot-instructions.md` | `.agents/skills/` |

- 필수 규칙(스킬 목록, 필수 사용 시점)을 바꾸면 요약이 들어 있는 `.cursor/rules/agents.mdc`와 `.github/copilot-instructions.md`도 함께 갱신한다
- 새 에이전트를 지원하려면 그 도구가 읽는 파일을 만들어 이 파일을 가리키게 하고 위 표에 추가한다

<!-- portfolio-hub:project-guidance:start -->
## 포트폴리오 문서 입력 계약

- 기본 브랜치 루트 PROJECT.md를 프로젝트 소개의 원본으로 유지합니다. 프로젝트 초안 작업에서 이 저장소의 AI가 아래 규격으로 생성하고 내용 변경 시 함께 갱신합니다. Hub는 내용을 AI로 다시 생성하지 않고 검증한 필드를 그대로 전송합니다.
- PROJECT.md는 첫 번째 JSON 코드 블록에 아래 메타데이터를 작성하고, 블록 뒤 빈 줄 다음에 마크다운 본문을 작성합니다. 본문의 제목·목차·내용 구성은 자유입니다.

```json
{
  "schemaVersion": 1,
  "slug": "project-slug",
  "title": "프로젝트 제목",
  "description": "프로젝트 설명",
  "stacks": ["TypeScript"],
  "image": "https://example.com/public-project.png",
  "linkDemo": null,
  "linkGithub": null
}
```

- schemaVersion, slug, title, description, stacks는 필수입니다. slug는 기존 프로젝트 식별자로 유지하며 변경하면 다른 프로젝트가 생성될 수 있습니다. stacks는 문자열 배열입니다. JSON에 계약 밖 필드를 추가하지 않습니다.
- image는 선택적인 공개 HTTP(S) 이미지 URL입니다. URL이 제공된 경우에만 기존 이미지를 교체합니다. 생략/null/빈 문자열이면 기존 이미지를 유지하며, 신규 프로젝트는 이미지 없이 생성합니다. 로컬 파일 경로·비공개 GitHub 원본 URL·자격 증명이 필요한 URL을 넣지 않습니다.
- 대표 이미지 파일을 저장소에 보관할 때는 루트 PROJECT.png를 사용합니다. 적절한 배포 화면이 있으면 활용하고 없으면 이 저장소에서 생성형 썸네일을 준비합니다. 필요한 경우 갱신하며 일반 코드 변경마다 재생성하지 않습니다.
- 공개 이미지 업로드와 공개 URL 준비는 이 저장소가 담당합니다. Hub는 이미지 파일을 읽거나 업로드하지 않습니다. 도구를 사용할 수 없거나 URL을 제공하지 못하면 image를 생략할 수 있습니다.
- linkDemo와 linkGithub는 선택적인 HTTP(S) 링크이며 생략/null/빈 문자열이면 기존 링크 값을 지웁니다. JSON 뒤 마크다운 전체를 API의 content로 사용하므로 중복 생성하지 않습니다.
- 이 규격 문서가 있으면 Hub가 프로젝트를 생성·업데이트하며 즉시 공개하고 관리자 편집 내용도 교체합니다. 공개 가능한 소개만 작성하고 비밀값·내부 정보는 넣지 않습니다. 이 지침은 다른 비공개 파일을 공개할 권한을 부여하지 않습니다.
- 기존 프로젝트 규칙과 함께 적용하며 충돌은 담당자에게 확인합니다. Hub는 이 구간 밖의 기존 규칙과 원본 PROJECT.md를 변경하지 않습니다. 지침 PR은 담당자가 직접 머지합니다.
<!-- portfolio-hub:project-guidance:end -->
