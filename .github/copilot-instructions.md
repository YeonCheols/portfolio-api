# Copilot Instructions

이 저장소의 에이전트 지침 원본은 루트의 `AGENTS.md`입니다. 작업 전에 `AGENTS.md`를 읽고 따릅니다.

필수 규칙 요약 (상세 절차는 `.agents/skills/<name>/SKILL.md`):

- 코드 수정 시 `tdd` 스킬: 실패하는 테스트를 먼저 작성하고, 수정한 파일의 관련 테스트를 반드시 추가하거나 수정한다
- 커밋 시 `commit` 스킬: `<type>: <한국어 요약>` 형식, 검증 후 선별 스테이징
- PR 생성 시 `pr` 스킬: `.github/pull_request_template.md` 형식, 담당자는 `gh` 활성 계정
- 검증은 `qa` 스킬: `pnpm lint:check`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`
- 응답은 한국어, 패키지 매니저는 pnpm

이 파일과 `AGENTS.md`가 다르면 `AGENTS.md`를 따릅니다.
