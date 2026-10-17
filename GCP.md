# GCP 이전 구상

상태: 검토용 초안. 코드와 인프라는 아직 바꾸지 않는다.

Git 저장소(`YeonCheols/portfolio-api`)와 GitHub Actions는 유지한다. 바꾸는 것은 요청을 받는 서버다. 지금은 `vercel.json`이 `src/main.ts`를 `@vercel/node` 함수로 올리고, `https://api.ycseng.com`이 그 함수를 가리킨다.

## 권장 형태

NestJS 프로세스를 컨테이너로 만들어 **Cloud Run**에 올린다. 이 앱은 `app.listen`으로 포트를 여는 상시 서버라서, 함수 한 번 호출마다 프로세스를 띄우는 방식보다 컨테이너 한 개가 맞다.

| 항목 | 방향 |
|------|------|
| 실행 | Cloud Run, 컨테이너 1개 (`node dist/main`) |
| 이미지 | Artifact Registry |
| 배포 | `master` 푸시 후 GitHub Actions가 이미지를 빌드해 Cloud Run에 배포 |
| 도메인 | `api.ycseng.com` 유지. DNS만 전환 |
| 비밀값 | Secret Manager. 이름만 코드에 있고 값은 지금과 같이 커밋하지 않음 |
| 데이터베이스 | 기존 PostgreSQL 유지. Cloud SQL로 옮기지 않음 |
| 리전 | 아시아. 기본안은 서울 `asia-northeast3` |
| 최소 인스턴스 | 0. 요청이 있을 때만 과금 |
| 결제 | 신규 계정이면 90일 $300 크레딧. 이후에는 Free Tier 안에서 유지 |
| 프런트 | `www.ycseng.com`, `admin.ycseng.com`은 그대로 두고 API 주소만 같게 유지 |

## 리전

서비스는 아시아에 둔다. 기본안은 서울(`asia-northeast3`)이다. 방문자가 한국이고, 지금 Vercel 배포도 인천(icn1)이다. 데이터베이스는 그대로 쓰므로, Cloud Run은 그 DB와 왕복이 짧은 쪽에 둔다. DB가 서울·도쿄·싱가포르가 아니면 리전만 다시 고른다.

서울은 Cloud Run 요금 **Tier 2**다. 도쿄(`asia-northeast1`)와 오사카는 Tier 1이라 단가가 더 낮다. 서울에는 커스텀 도메인 매핑이 없다. `api.ycseng.com`은 **전역 외부 HTTPS 부하 분산 + 서버리스 NEG**로 연결한다. 도메인 매핑이 되는 리전(도쿄 포함)은 미리보기 기능이고, 일부 지역에서 지연이 보고되어 운영 경로로 두지 않는다. 출처: [Cloud Run locations](https://docs.cloud.google.com/run/docs/locations), [Cloud Run pricing](https://cloud.google.com/run/pricing).

부하 분산기는 Cloud Run Free Tier와 별도다. 포워딩 규칙 요금이 매월 나오므로, 크레딧이 끝난 뒤의 고정비는 여기서 생긴다. 금액을 확정할 때는 [가격 계산기](https://cloud.google.com/products/calculator)에 서울 리전과 부하 분산을 넣어 본다.

## 최소 인스턴스

**0으로 둔다.** 과금은 요청 기반(CPU는 요청을 처리할 때만 할당)이다.

이 API는 상시 트래픽이 없다. 최소 인스턴스 0이면 요청이 없을 때 인스턴스 요금이 없다. Cloud Run은 요청이 끝난 인스턴스를 최대 15분까지 유휴로 남겨 둘 수 있고, 최소 인스턴스가 아닌 유휴 인스턴스는 과금하지 않는다. 15분이 지나면 다음 요청에서 Nest 기동과 DB 연결이 다시 난다.

최소 인스턴스 1은 그 대기 시간을 없앤다. 대신 요청이 없어도 유휴 단가로 한 달을 과금한다. 가격표의 요청 기반 유휴 단가(vCPU초 $0.0000025, GiB초 $0.0000025)로 1 vCPU · 512MiB를 730시간 유지하면 CPU 약 $6.6, 메모리 약 $3.3, 합계 약 $10이다. 이 단가는 가격표의 기본 열이고, 서울은 Tier 2라 실제는 더 높다. 요청 기반 Free Tier(월 180,000 vCPU초, 360,000 GiB초, 요청 200만 건)는 Tier 1 가격으로 할인되므로, 최소 인스턴스 1의 한 달을 다 덮지 못한다.

지금 있는 매시간 `/health/db` 크론은 최소 인스턴스 0에서도 한 시간에 한 번 프로세스를 깨운다. 깨운 뒤 15분 정도는 다음 방문이 따뜻하고, 그 다음부터는 다시 식는다. 크론을 인스턴스를 살리는 용도로 늘리지는 않는다. Actions 무료 분(월 2,000분)을 쓰고, 잠든 사이의 첫 방문은 그대로 느리다.

콜드 스타트가 전환 후에 거슬리면 그때 최소 인스턴스를 1로 올린다. 그 시점의 월 요금은 계산기로 확인한다.

## 결제

신규 Google Cloud 고객은 **90일 동안 $300 Welcome 크레딧**을 받는다. 조건은 지금까지 Google Cloud, Google Maps Platform, Firebase의 유료 고객이었던 적이 없고, Free Trial에 가입한 적도 없는 계정이다. 가입할 때 결제 수단을 등록한다. 체험 계정인 동안에는 그 카드로 사용료가 청구되지 않는다. 크레딧을 다 쓰거나 90일이 지나면 체험 결제 계정이 닫히고, 업그레이드하지 않으면 30일 유예 뒤에 리소스가 삭제된다. 유예 안에 유료 계정으로 바꾸면 남은 크레딧은 가입일로부터 90일까지 계속 쓸 수 있다. 출처: [Free Trial](https://docs.cloud.google.com/free/docs/free-cloud-features), [Free Trial 약관](https://cloud.google.com/terms/free-trial/).

Free Tier는 크레딧과 별개로 매월 갱신된다. 이 서비스가 쓰는 요청 기반 Cloud Run 한도는 월 요청 200만 건, 180,000 vCPU초, 360,000 GiB초다. 최소 인스턴스 0과 이 포트폴리오 트래픽이면 크레딧이 끝난 뒤에도 이 한도 안에 둔다. Artifact Registry 스토리지와 부하 분산기는 이 한도 밖이라 계산기에서 따로 본다.

스타트업 프로그램의 최대 $350,000 크레딧은 개인 포트폴리오 대상이 아니다.

결제 계정 `내 결제 계정`은 이미 무료 체험판이고 조직은 없다. 개인 프로젝트에 맞다. 크레딧 페이지에서 무료 크레딧이 있는 것을 확인했다. 새 체험에 다시 가입할 수는 없다. 남은 금액과 종료일은 [크레딧](https://console.cloud.google.com/billing/credits)에 있다. 크레딧이 끝나기 전에 유료 계정으로 바꾸지 않으면 리소스가 멈춘다.

## 그대로 두는 것

- GitHub 저장소, `master` / `dev` / 기능 브랜치, PR, `ci.yml`
- `master` 푸시 때 태그·릴리스를 만드는 `release-tag.yml`
- `ai-review.yml` (`/review` 댓글)
- Prisma PostgreSQL, 마이그레이션 파일. 배포 중에 `prisma migrate`를 자동 실행하지는 않는다. 지금도 Vercel 빌드는 생성만 한다
- 로컬 개발의 `cert/` HTTPS. 인증서는 컨테이너에 넣지 않는다
- CORS 허용 출처. `src/main.ts`의 `www.ycseng.com`, `admin.ycseng.com` 목록이 기준이 된다

## 서버를 떼면 달라지는 것

1. **포트.** `src/main.ts`는 `4001`에 고정돼 있다. Cloud Run은 `PORT`(보통 8080)로 받는다. 배포 전에 `process.env.PORT`를 듣고, 로컬에서만 4001을 쓰게 바꿔야 한다.
2. **프로세스 명령.** `start:prod`는 `nest start`라 컴파일 결과를 실행하지 않는다. 컨테이너 시작 명령은 `node dist/main`이다.
3. **CORS 헤더.** `vercel.json` 라우트가 `Access-Control-Allow-Origin: *`를 붙인다. Cloud Run에는 이 파일이 없다. 응답 CORS는 `main.ts`의 출처 목록만 적용된다. 전환 전에 브라우저에서 `www`, `admin` 요청이 통과하는지 확인한다.
4. **Prisma 생성 위치.** `schema.prisma`의 `clientTypes`와 `.npmrc`의 `public-hoist-pattern`은 `@vercel/node`가 심볼릭 링크를 따라가지 않아서 넣었다. 컨테이너에서는 기본 `client` 생성기로 충분하다. Vercel을 끈 뒤 제거하는 후속 작업으로 둔다.
5. **콜드 스타트.** 최소 인스턴스는 0이다. 15분 넘게 요청이 없으면 다음 요청에서 프로세스가 다시 뜬다. 자세한 비용은 위의 최소 인스턴스 절을 본다.
6. **헬스 크론.** `.github/workflows/health-check.yml`은 매시간 `https://api.ycseng.com/health/db`를 친다. 전환 후에도 URL이 같으면 워크플로는 수정하지 않아도 된다. Cloud Run 시작 프로브는 `/health`를 쓰고, `/health/db`는 죽이는 조건으로 쓰지 않는다. DB가 잠깐 끊겨도 프로세스를 내리지 않기 위해서다.

## 환경 변수

값은 옮기지 않고 이름만 적는다. Vercel 프로젝트 설정을 Secret Manager로 복사한다.

| 이름 | 쓰임 |
|------|------|
| `DATABASE_URL` | Prisma 런타임 연결 |
| `DATABASE_DIRECT_URL` | Prisma 마이그레이션용 직접 연결 |
| `JWT_SECRET` | 관리자 토큰 서명 |
| `RESEND_API_KEY` | 메일 발송 |
| `MAIL_FROM` | 발신 주소. 없으면 코드의 기본값 |
| `MAIL_TO` | 수신 주소. 없으면 코드의 기본값 |
| `NODE_ENV` | 운영은 `prd` |
| `PORT` | Cloud Run이 주입 |

## 배포 흐름

```text
기능 브랜치 → PR (ci.yml)
        → master 머지
            → release-tag.yml (태그, 지금과 같음)
            → deploy.yml (신규)
                이미지 빌드 → Artifact Registry
                → Cloud Run 새 리비전
                → /health, /health/db 확인
                → 실패하면 이전 리비전으로 트래픽 유지
```

GitHub Actions에서 GCP로 배포할 때는 키 파일을 저장소 시크릿에 넣지 않는다. Workload Identity Federation으로 `id-token`만 넘긴다. `release-tag.yml`에는 이미 `id-token: write`가 있으므로 배포 워크플로도 같은 방식을 쓴다.

이미지는 `pnpm install --frozen-lockfile`, `pnpm prisma:generate`, `pnpm build` 순서로 만들고, 실행 스테이지에는 `dist/`, 생성된 Prisma 클라이언트, 프로덕션 의존성만 남긴다.

## 전환 순서

1. GCP 프로젝트, Artifact Registry, Cloud Run 서비스, Secret Manager, 배포 서비스 계정을 만든다. 데이터베이스 방화벽에 Cloud Run이 나갈 수 있는 경로를 연다. Cloud Run 이그레스 IP를 고정하려면 Cloud NAT가 필요하다. 기존 DB가 IP 허용 목록이면 이 단계가 먼저다.
2. `PORT`를 받도록 앱을 고치고, 컨테이너로 로컬에서 `/health`와 `/health/db`를 확인한다.
3. `master`가 아닌 브랜치의 배포 워크플로로 Cloud Run URL(`*.run.app`)에 올린다. `api.ycseng.com`은 아직 Vercel이다.
4. `*.run.app`에서 공개 API, 관리자 로그인, 메일, Swagger(`/api`)를 확인한다.
5. 부하 분산과 인증서를 만들고, DNS TTL을 낮춘 뒤 `api.ycseng.com`을 GCP로 옮긴다. 기존 시간별 헬스 체크가 200이면 전환이 끝난 것이다.
6. Vercel 프로젝트의 자동 배포를 끄고, 하루 이상 지난 뒤 Vercel 환경 변수와 프로젝트를 정리한다.
7. 후속: `clientTypes` 생성기, `typecheck:vercel`, `build:vercel`, `vercel.json`, `deploy` 스크립트 제거.

롤백은 DNS를 Vercel로 되돌리는 것이다. 그래서 6번 전에는 Vercel 배포를 지우지 않는다.

## 범위 밖

- 데이터베이스를 Cloud SQL로 옮기는 일
- 프런트엔드 호스팅
- PR마다 프리뷰 URL을 만드는 일. 운영은 `master`만 배포한다
- 로컬 `cert/`와 `local.ycseng.com`

## 정해진 것

1. PostgreSQL은 그대로 둔다.
2. 리전은 아시아. 기본안은 서울이고, `api.ycseng.com`은 부하 분산으로 연결한다.
3. 최소 인스턴스는 0, 과금은 요청 기반이다.
4. 결제는 이미 만든 무료 체험판 계정 `내 결제 계정`을 쓴다. 이후에는 Cloud Run Free Tier 안에 둔다.

## 남은 확인

1. 기존 데이터베이스가 어느 리전에 있는지. 아시아 밖이면 Cloud Run 리전만 맞춘다.
2. 부하 분산기 월 고정비를 계산기로 확정한 금액.
