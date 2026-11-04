# AI 모델 설정과 API 키 계약

모델 설정·환경별 활성 상태·실제 API 키는 portfolio-api가 소유합니다.
MCP의 GitHub 로그인 관리 화면은 입력·변경 요청을 전달하며, MCP 도구는 보호된 활성 조회에서 받은 키를 요청별 모델 클라이언트에만 전달합니다.
모델 키를 GCP Secret Manager 참조명이나 정적 MCP 환경변수로 관리하지 않습니다.

## 지원 공급자

`provider`는 Prisma의 `ResumeModelProvider` enum을 사용하며 다음 값을 허용합니다.

- `openrouter`는 `https://openrouter.ai` 호스트를 사용합니다.
- `openai`는 `https://api.openai.com` 호스트를 사용합니다.
- `gemini`는 `https://generativelanguage.googleapis.com` 호스트를 사용합니다.

각 공급자의 주소에 다른 공급자 호스트, HTTP, 사용자 정보가 포함된 URL은 허용하지 않습니다.
모델 이름과 호출 경로는 설정에 저장하며 API는 모델 공급자를 직접 호출하지 않습니다.
공식 호스트 근거는 [OpenAI API Reference](https://developers.openai.com/api/reference/overview)와
[Gemini API Reference](https://aistudio.google.com/api-reference/all-methods)에서 확인합니다.

기존 DB에는 `20261104001202_add_openai_gemini_providers` migration을 먼저 적용한 뒤 API를 배포합니다.
이 migration은 기존 공급자와 설정을 보존하며 enum에 `openai`와 `gemini`만 추가합니다.
MCP의 공급자 어댑터와 관리 화면 지원은 별도 작업이며 해당 배포 후 새 공급자 설정을 활성화합니다.

## 생성

`POST /service/resume-model-setting`은 MCP 서비스 인증 토큰으로 보호합니다. 새 설정은 비활성으로 생성합니다.

```json
{
  "environment": "production",
  "provider": "openrouter",
  "modelName": "vendor/model",
  "url": "https://openrouter.ai/api/v1/chat/completions",
  "apiKey": "<실제 모델 API 키>"
}
```

`apiKey`는 1~4096자이며 빈 값·줄바꿈·NUL을 거부합니다. 모델의 호출 주소는 공급자별 공식 HTTPS 호스트로 제한합니다.
`secretRef`는 새 입력 계약에 포함하지 않습니다.

## 수정

`PUT /service/resume-model-setting/:id`은 비활성 설정만 수정하며 기존 환경을 유지합니다.
`apiKey`를 생략하면 기존 키를 보존하고 새 값을 보내면 교체합니다. 빈 문자열을 보내면 기존 키를 삭제하지 않고 오류를 반환합니다.
활성 설정을 바꾸려면 새 설정을 만들고 `POST /service/resume-model-setting/:id/activate`로 활성화합니다.
실제 키가 없는 기존 설정은 활성화하지 않으며 이전 활성 설정도 해제하지 않습니다.

## 관리 응답

생성·목록·수정·활성화·삭제 결과에는 실제 키를 포함하지 않고 등록 여부만 반환합니다.
관리자 JWT 경로인 `/admin/resume-model-setting`도 같은 응답을 사용합니다.

```json
{
  "id": 1,
  "environment": "production",
  "provider": "openrouter",
  "modelName": "vendor/model",
  "url": "https://openrouter.ai/api/v1/chat/completions",
  "isActive": true,
  "hasApiKey": true,
  "createdAt": "2026-11-03T00:00:00.000Z",
  "updatedAt": "2026-11-03T00:00:00.000Z"
}
```

목록은 위 객체의 배열입니다. 화면은 키 원문을 다시 표시하거나 미리 채우지 않습니다.
MCP 화면에서는 기존 `/admin/ai-models/api/settings` 경로를 사용하며 서버가 portfolio-api에 전달합니다.

## MCP 런타임 조회

`GET /resume-model-setting/active?environment=production`은 `RESUME_MODEL_SETTING_TOKEN`의 Bearer 인증으로만 조회합니다.
실제 모델 키를 반환하는 응답은 `Cache-Control: no-store`를 사용합니다.

```json
{
  "provider": "openrouter",
  "modelName": "vendor/model",
  "url": "https://openrouter.ai/api/v1/chat/completions",
  "apiKey": "<실제 모델 API 키>"
}
```

활성 설정이 없으면 404, 실제 키가 비어 있으면 503을 반환하며 다른 모델·참조명·환경변수로 대체하지 않습니다.
모델 키와 조회 인증 토큰은 서로 다른 값입니다. 조회 토큰은 portfolio-config의 정적 연결 정보로 유지합니다.

## 적용 순서

1. DB migration을 적용합니다. 운영 DB에는 2026-11-03 적용하고 상태를 검증했습니다.
2. portfolio-api의 새 계약을 배포합니다.
3. MCP 설정 화면·런타임을 배포합니다.
4. 화면에서 실제 키가 있는 설정을 생성하고 환경별로 활성화합니다.
5. MCP 요청별로 활성 모델과 키가 조회되는지 확인합니다.

이 문서와 코드 작성 단계에서 실제 모델 키는 입력하거나 운영 모델 API를 호출하지 않았습니다.
