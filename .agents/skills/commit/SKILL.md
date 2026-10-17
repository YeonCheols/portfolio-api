---
name: commit
description: 변경사항을 검토·검증한 뒤 이 저장소의 컨벤션(Conventional Commits 타입 + 한국어 설명)으로 커밋한다. 사용자가 커밋, 커밋 메시지 작성, 커밋 후 푸시를 요청할 때 사용한다.
disable-model-invocation: true
---

# Commit

## 절차

```
- [ ] 1. 상태 파악: git status, git diff, git diff --staged, git log --oneline -10
- [ ] 2. 커밋 대상 선별 (관련 없는 변경/민감 파일 제외)
- [ ] 3. 검증: pnpm lint, 변경 범위 관련 pnpm test
- [ ] 4. 논리 단위로 스테이징 (git add <파일>; git add -A 지양)
- [ ] 5. 커밋 메시지 작성 및 커밋
- [ ] 6. git status로 결과 확인, 요청 시에만 푸시
```

## 커밋 대상 제외

- `.env*`, `cert/`, `.vercel/`, `dist/`, `docs/`, `.DS_Store`, 기타 비밀값이 포함된 파일
- 사용자가 작업 중인 무관한 변경 (건드리지 말고 그대로 둔다)
- 위 파일이 스테이징돼 있으면 커밋 전 사용자에게 알린다

## 메시지 형식

```
<type>: <한국어 요약>

<선택: 변경 이유/상세 (한국어, 72자 줄바꿈)>
```

- type: `feat` 기능 추가, `fix` 버그/동작 수정, `refactor`, `test`, `docs`, `chore` 빌드·설정, `style` 포맷
- 요약은 50자 내외, 마침표 없음. 도메인 > 세부 형태 허용
- 서로 다른 목적의 변경은 커밋을 분리한다

예시 (이 저장소 기존 커밋):

```
fix: 프로젝트 검색 > project count query 수정
feat: 메일 발송 api 추가
chore: Update vercel.json to use dist/main.js
```

## 커밋 실행

여러 줄 메시지는 HEREDOC 사용:

```bash
git commit -m "$(cat <<'EOF'
feat: 태그 검색 api > 페이징 추가

검색 결과에 page/size/allTotal을 함께 반환
EOF
)"
```

## 금지 사항

- `--no-verify`, `--amend`(사용자 요청 없을 때), `git push --force`
- `master`에 직접 커밋/푸시 — 현재 브랜치가 `master`면 멈추고 사용자에게 확인
- 검증 실패 상태로 커밋 — 실패 내용을 보고하고 사용자 판단을 받는다

## 푸시 (요청 시)

`git push` (업스트림 없으면 `git push -u origin <branch>`). 결과의 커밋 해시와 브랜치를 보고한다.
