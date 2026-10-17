---
name: pr
description: 현재 브랜치의 변경사항으로 저장소 PR 템플릿(.github/pull_request_template.md)에 맞춘 GitHub Pull Request를 gh CLI로 생성한다. 사용자가 PR 생성, PR 올리기, PR 설명 작성을 요청할 때 사용한다.
disable-model-invocation: true
---

# Pull Request

## 절차

```
- [ ] 1. 브랜치 확인: git branch --show-current (master면 중단하고 사용자 확인)
- [ ] 2. 베이스 결정: 기본 master (사용자가 지정하면 그 브랜치)
- [ ] 3. 커밋되지 않은 변경 확인 → 있으면 commit 스킬 진행 여부를 사용자에게 확인
- [ ] 4. 변경 분석: git log --oneline origin/<base>..HEAD, git diff origin/<base>...HEAD --stat
- [ ] 5. 검증: pnpm lint, pnpm test, pnpm build
- [ ] 6. 원격 푸시: git push -u origin HEAD
- [ ] 7. 담당자 계정 확인: gh api user --jq .login
- [ ] 8. 템플릿에 맞춰 본문 작성 후 gh pr create --assignee <login>
- [ ] 9. 담당자 지정 검증: gh pr view --json assignees
- [ ] 10. 코드 리뷰: review 스킬 branch 모드 → 결과를 PR 댓글로 작성
- [ ] 11. PR URL과 리뷰 요약 보고
```

먼저 `git fetch origin`으로 베이스를 최신화하고, 이미 열린 PR이 있는지 `gh pr list --head <branch>`로 확인한다. 있으면 새로 만들지 않고 `gh pr edit`로 갱신할지 사용자에게 묻는다.

## 제목

마지막 커밋이 아니라 **브랜치 전체 변경**을 요약한다. 커밋 컨벤션과 동일하게 `<type>: <한국어 요약>`.

## 본문 (`.github/pull_request_template.md` 기반)

```markdown
## 설명

<이 PR이 해결하는 문제와 접근 방식 1~3문장>

## 관련 이슈

<Fixes #번호 / 없으면 "없음">

## 변경사항

- <파일/도메인 단위 변경 요약>
- <API 변경 시 메서드 + 경로, 요청/응답 필드 변화>
- <Prisma 스키마/마이그레이션 변경 여부>

## 체크리스트

- [x] 프로젝트의 코딩 스타일 가이드라인을 준수했습니다.
- [x] 코드가 오류 없이 컴파일되고 실행됩니다.
- [ ] 제안된 변경사항에 대해 테스트를 완료했으며 예상대로 동작합니다.
- [ ] 기존의 모든 테스트가 성공적으로 통과됩니다.
- [ ] 변경사항에 대한 새로운 테스트가 추가되었습니다 (해당되는 경우).
- [ ] 문서가 업데이트되었습니다 (해당되는 경우).

## 스크린샷 (해당되는 경우)

<Swagger 응답 예시 등, 없으면 섹션 내용 "없음">

## 추가 참고사항

<배포 시 주의점, 환경변수 추가, 마이그레이션 실행 필요 여부 등>
```

체크리스트는 5단계 검증 결과에 따라 **실제로 확인된 항목만** `[x]`로 표시한다.

## 담당자 (assignee) — 필수

PR 담당자는 **반드시 현재 `gh`에 로그인된 활성 GitHub 계정**으로 지정한다. 담당자 없이 PR을 만들지 않는다.

```bash
gh auth status                       # 활성 계정(Active account: true) 확인
ASSIGNEE=$(gh api user --jq .login)  # 활성 계정 로그인 이름
```

- 계정이 여러 개 로그인돼 있으면 활성 계정을 사용하고, 어떤 계정으로 지정했는지 보고한다
- 로그인돼 있지 않거나 `gh api user`가 실패하면 PR을 만들지 말고 `gh auth login`을 사용자에게 요청한다
- 다른 계정을 지정하려고 `gh auth switch`를 임의로 실행하지 않는다

## 생성 명령

```bash
gh pr create --base master --assignee "$ASSIGNEE" --title "feat: 태그 검색 페이징 추가" --body "$(cat <<'EOF'
...본문...
EOF
)"
```

생성 후 담당자를 검증한다. 비어 있으면 `gh pr edit <번호> --add-assignee "$ASSIGNEE"`로 지정하고 다시 확인한다.

```bash
gh pr view <번호> --json assignees --jq '.assignees[].login'
```

- 사용자가 요청하면 `--draft`, `--reviewer`, `--label` 추가
- 머지는 사용자 명시 요청 없이는 하지 않는다

## 코드 리뷰 댓글

PR 생성 후 `review` 스킬을 branch 모드로 실행하고, 결과를 PR 댓글로 남긴다. 본인 PR은 approve할 수 없으므로 리뷰는 댓글로 남긴다.

```bash
# 본문 첫 줄은 <!-- ai-review:local --> (CI 리뷰 댓글 <!-- ai-review:ci -->와 구분)
gh pr comment <번호> --body-file /tmp/review-<번호>.md
```

- PR에 커밋을 추가로 푸시한 경우 리뷰를 다시 실행해 새 댓글을 남긴다
- CI(`ai-review` 워크플로)도 같은 스킬로 자동 리뷰 댓글을 남긴다. 로컬 리뷰와 CI 리뷰의 🔴 항목은 모두 머지 전 확인 대상이다
- CI 리뷰를 다시 돌리려면 PR에 `/review` 댓글을 단다 (`gh pr comment <번호> --body "/review"`, 문서만 바뀐 PR도 리뷰됨)

## 머지 (요청 시) — CI 통과 필수

비공개 Free 플랜이라 브랜치 보호로 CI 실패 PR의 머지를 막을 수 없다. 머지 전에 **반드시** 모든 체크가 통과했는지 직접 확인한다.

```bash
gh pr checks <번호> --watch --fail-fast   # 끝날 때까지 대기, 하나라도 실패하면 종료 코드 1
gh pr merge <번호> --merge                # 위 명령이 성공(0)했을 때만 실행
```

- 체크가 실패·취소되었거나 아직 실행되지 않았으면 머지하지 않고 실패한 체크와 원인을 사용자에게 보고한다
- 리뷰 댓글(`ai-review:local`, `ai-review:ci`)의 **가장 최근 것**에 해결되지 않은 🔴 항목이 있으면 머지하지 않고 보고한다. AI 리뷰는 댓글만 남기고 체크를 실패시키지 않으므로, 이 확인은 체크 통과와 별개로 반드시 수행한다

```bash
gh pr view <번호> --json comments --jq '[.comments[] | select(.body | test("ai-review:"))] | last | .body' | grep "🔴"
```
- 사용자가 실패를 알고도 머지를 명시적으로 요청한 경우에만 예외로 하고, 그 사실을 보고에 남긴다
- `master` 머지는 Production 배포로 이어지므로, 머지 후 Vercel 배포 상태와 주요 API 응답을 확인해 보고한다

## 보고

PR 링크를 마크다운 링크로 제공하고, 지정된 담당자 계정과 검증 중 실패하거나 건너뛴 항목을 함께 알린다.
