---
name: tdd
description: NestJS + Prisma 프로젝트에서 Red-Green-Refactor 사이클로 코드를 수정한다. src/, test/, prisma/, utils/ 코드를 수정하는 모든 작업(기능 추가, 버그 수정, 리팩터링)에서 반드시 사용하며, 사용자가 "TDD로", "테스트 먼저"를 요청할 때도 사용한다.
---

# TDD (Red → Green → Refactor)

## 체크리스트

```
- [ ] 1. 요구사항을 테스트 케이스 목록으로 정리 (정상/경계/예외)
- [ ] 2. Red: 실패하는 테스트 1개 작성 → 실패 확인
- [ ] 3. Green: 테스트를 통과하는 최소 구현 → 통과 확인
- [ ] 4. Refactor: 중복 제거/정리 → 여전히 통과 확인
- [ ] 5. 남은 케이스에 대해 2~4 반복
- [ ] 6. 관련 전체 테스트 + 린트 실행
```

## 원칙: 코드 수정 = 테스트 추가/수정

모든 코드 수정에는 **수정한 파일과 관련된 테스트 코드의 추가 또는 수정이 반드시 함께 포함**되어야 한다.

- 수정한 파일(`<name>.ts`)마다 대응하는 테스트(`<name>.spec.ts`)를 확인한다
  - 테스트 파일이 없으면 새로 만든다
  - 있으면 변경된 동작에 맞게 케이스를 추가하거나 기존 기대값을 수정한다
- 동작이 바뀌면 그 동작을 검증하는 케이스가 있어야 하고, 버그 수정에는 해당 버그를 재현하는 케이스가 있어야 한다
- 리팩터링처럼 동작이 바뀌지 않는 수정은 기존 테스트로 동작이 보호되는지 확인하고, 커버되지 않는 경로가 있으면 테스트를 먼저 보강한다
- 테스트 대상이 아닌 파일(DTO 단순 필드, 모듈 등록, `*.md`, 설정)만 바꾸는 경우는 예외다. 대신 완료 보고에 테스트를 추가하지 않은 파일과 그 이유를 적는다
- 테스트 없이 구현만 바뀐 상태로 작업을 끝내지 않는다

## 규칙

- 구현 코드보다 테스트를 **먼저** 작성하고, 실패를 실제로 실행해 확인한다 (실패 이유가 "기능 미구현"이어야 함. import 오류 등은 Red가 아님)
- 한 사이클에 테스트 1개만 추가한다
- Green 단계에서는 테스트를 통과시키는 데 필요한 코드만 작성한다
- 테스트를 통과시키려고 테스트 기대값을 바꾸지 않는다

## 파일 위치와 실행

- 단위 테스트: 대상 파일 옆 `<name>.spec.ts` (Jest `rootDir`가 `src`)
- e2e 테스트: `test/<name>.e2e-spec.ts`
- 단일 파일 실행: `pnpm test -- apps/admin/tag/tag.service.spec.ts`
- 감시 모드: `pnpm test:watch`

## 사전 확인: `src/...` 경로 매핑

서비스는 `src/prisma/prisma.service` 같은 절대경로를 import하는데, 현재 Jest 설정에 매핑이 없으면 `Cannot find module 'src/...'`로 실패한다. 이 오류가 나면 사용자에게 알리고 동의를 받은 뒤 `package.json`의 `jest`에 추가한다:

```json
"moduleNameMapper": { "^src/(.*)$": "<rootDir>/$1" }
```

## 서비스 테스트 템플릿 (PrismaService 모킹)

```ts
import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminTagService } from "./tag.service";

describe("AdminTagService", () => {
  let service: AdminTagService;
  const prisma = {
    tag: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [AdminTagService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AdminTagService);
  });

  describe("findOne", () => {
    it("태그가 없으면 NotFoundException을 던진다", async () => {
      prisma.tag.findUnique.mockResolvedValue(null);
      await expect(service.findOne("none")).rejects.toThrow(NotFoundException);
    });
  });
});
```

## 컨트롤러 테스트

컨트롤러는 서비스를 `useValue`로 모킹하고, 서비스 호출 인자와 반환값 전달만 검증한다. 인증 가드가 붙은 컨트롤러는 `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })`로 우회한다.

## 테스트 작성 기준

- 테스트명은 한국어로 "~하면 ~한다" 형식
- 비즈니스 규칙(페이징 계산, 검색 조건, 예외 처리, 관계 테이블 갱신)을 우선 검증
- Prisma 호출 인자는 `toHaveBeenCalledWith(expect.objectContaining({...}))`로 핵심 필드만 검증
- 실제 DB에 연결하는 테스트는 작성하지 않는다 (e2e는 사용자 요청 시에만)

## 완료 보고

다음을 요약한다.

- 수정한 파일과 그에 대응해 추가하거나 수정한 테스트 파일
- 사이클별로 추가한 테스트 케이스
- 테스트를 추가하지 않은 파일이 있으면 그 이유
- 최종 `pnpm test` 결과(통과/실패 수)
