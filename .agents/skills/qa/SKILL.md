---
name: qa
description: 변경사항에 대해 정적 검증(린트/타입/빌드), 테스트, API 동작 확인, 코드 리뷰 체크리스트를 수행하고 QA 리포트를 작성한다. 작업 완료 전 검증, 커밋/PR 직전, 사용자가 "QA", "검증", "점검"을 요청할 때 사용한다.
---

# QA

## 범위 파악

`git status`, `git diff` (브랜치 단위면 `git diff origin/master...HEAD`)로 변경 파일과 영향 받는 모듈(`src/apps/<admin|public>/<domain>`)을 확인한다.

## 1단계: 정적 검증

PR CI(`.github/workflows/ci.yml`)와 같은 명령을 사용한다.

```bash
pnpm lint:check
pnpm format:check
pnpm typecheck
pnpm build
```

- Prisma 스키마 변경 시 먼저 `pnpm prisma:generate`
- 실패하면 `pnpm lint` / `pnpm format`(자동 수정)으로 고친 뒤 다시 검사하고, 자동 수정된 파일을 리포트에 명시한다

## 2단계: 테스트

```bash
pnpm test
pnpm test:cov   # 변경 파일 커버리지 확인이 필요할 때
```

- 변경된 서비스/컨트롤러에 테스트가 없으면 "테스트 누락"으로 기록 (필요 시 `tdd` 스킬 제안)
- 기존부터 실패하던 테스트는 이번 변경과 구분해 기록한다 (`git stash` 없이 판단 근거만 제시)

## 3단계: API 동작 확인 (사용자 동의 시)

DB/환경변수가 필요하므로 실행 전 사용자에게 확인한다.

1. `pnpm start:dev` 를 백그라운드로 실행
2. 변경된 엔드포인트를 `curl`로 호출 — 정상 / 잘못된 입력(400) / 없는 리소스(404) / 인증 없음(admin, 401)
3. Swagger(`/api`)에 DTO 스키마가 반영됐는지 확인
4. 확인 후 서버 종료

## 4단계: 코드 리뷰 체크리스트

- [ ] DTO에 `class-validator`, Swagger 데코레이터가 있고 `dto/index.ts`에 export됨
- [ ] admin 엔드포인트에 `JwtAuthGuard` 적용, public에서 비공개 데이터(노출여부 등) 필터링
- [ ] 페이징: `page`/`size` 숫자 변환·기본값, `skip` 계산 정확
- [ ] 여러 쓰기 작업/관계 테이블 갱신은 `$transaction` 사용
- [ ] 없는 리소스 처리 (`NotFoundException` 등), Prisma 에러 노출 없음
- [ ] 새 모듈이 상위 `index.module.ts`에 등록됨
- [ ] Prisma 스키마 변경 시 마이그레이션 파일 포함
- [ ] 새 환경변수는 README에 문서화, 비밀값 하드코딩 없음
- [ ] `console.log` 디버그 코드, 사용하지 않는 import 없음

## 리포트 형식

```markdown
## QA 결과: <통과 | 조건부 통과 | 실패>

| 항목 | 결과 | 비고 |
|------|------|------|
| Lint | ✅/❌ | |
| 포맷 | ✅/❌ | |
| 타입 체크 | ✅/❌ | |
| 빌드 | ✅/❌ | |
| 단위 테스트 | ✅/❌ | n passed / m failed |
| API 확인 | ✅/❌/생략 | |

### 발견 사항
- 🔴 반드시 수정: <파일:라인 - 내용>
- 🟡 권장: <내용>
- 🟢 참고: <내용>

### 다음 단계
<수정 필요 항목 또는 commit/pr 진행 제안>
```

발견 사항은 보고만 하고, 수정은 사용자가 요청하거나 명백한 린트 자동수정에 한해 진행한다.
