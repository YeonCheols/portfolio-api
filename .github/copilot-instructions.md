# Copilot Instructions

이 저장소의 에이전트 지침 원본은 루트의 `AGENTS.md`입니다. 작업 전에 `AGENTS.md`를 읽고 따릅니다.

필수 규칙 요약 (상세 절차는 `.agents/skills/<name>/SKILL.md`):

- 코드 수정 시 `tdd` 스킬: 실패하는 테스트를 먼저 작성하고, 수정한 파일의 관련 테스트를 반드시 추가하거나 수정한다
- 커밋 시 `commit` 스킬: `<type>: <한국어 요약>` 형식, 검증 후 선별 스테이징, 코드 변경은 커밋 직전 `review` 스킬(staged)로 리뷰하고 🔴 있으면 중단
- PR 생성 시 `pr` 스킬: `.github/pull_request_template.md` 형식, 담당자는 `gh` 활성 계정, 생성 후 `review` 스킬(branch) 결과를 PR 댓글로 작성
- 검증은 `qa` 스킬: `pnpm lint:check`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`
- 코드 리뷰 기준은 `review` 스킬. 댓글은 `.agents/skills/review/TEMPLATE.md`만 채우고 발견마다 TDD 근거를 적는다. PR 자동 실행은 꺼 둠
- 응답은 한국어이고 문장은 표준 문장체인 `습니다`/`ㅂ니다`로 끝낸다. 패키지 매니저는 pnpm
- `master` 기준 작업 전에는 `git fetch origin`으로 `origin/master` 최신을 받는다

이 파일과 `AGENTS.md`가 다르면 `AGENTS.md`를 따릅니다.
