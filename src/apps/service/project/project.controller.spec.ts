import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { PrismaModule } from "src/prisma/prisma.module";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService } from "src/apps/public/auth/auth.service";
import { AdminProjectService } from "src/apps/admin/project/project.service";
import { ServiceProjectModule } from "./project.module";
import { GUARDS_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { INestApplication, RequestMethod } from "@nestjs/common";
import { ProjectServiceTokenGuard } from "src/apps/public/auth/project-service-token.guard";
import { ServiceProjectController } from "./project.controller";

describe("ServiceProjectController", () => {
  it("공통 서비스 가드의 PUT으로 전체 프로젝트를 upsert하고 응답에 최근 표시를 제공한다", async () => {
    const service = {
      upsert: jest.fn().mockResolvedValue({
        operation: "updated",
        project: { id: 1, slug: "portfolio-admin", updatedAt: new Date() },
      }),
    };
    const controller = new ServiceProjectController(service as never);
    const body = {
      slug: "portfolio-admin",
      title: "관리자",
      description: "설명",
      image: "",
      stacks: "[]",
      content: "자유 형식 본문",
    };
    await expect(controller.upsert(body)).resolves.toMatchObject({
      operation: "updated",
      project: { slug: body.slug, isRecent: true },
    });
    expect(service.upsert).toHaveBeenCalledWith(body);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ServiceProjectController),
    ).toContain(ProjectServiceTokenGuard);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method -- 호출 없이 라우트 메타데이터만 검사합니다.
        ServiceProjectController.prototype.upsert,
      ),
    ).toBe(RequestMethod.PUT);
  });
});

describe("공통 프로젝트 HTTP 계약 (가짜 DB·인증)", () => {
  it("무인증은 거부하고 유효한 자유 형식 본문만 저장 경계로 전달한다", async () => {
    const service = {
      upsert: jest.fn().mockResolvedValue({
        operation: "created",
        project: { id: 1, slug: "p1", updatedAt: new Date() },
      }),
    };
    const auth = {
      validateProjectServiceToken: jest.fn().mockResolvedValue(undefined),
    };
    const module = await Test.createTestingModule({
      imports: [PrismaModule, ServiceProjectModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AuthService)
      .useValue(auth)
      .overrideProvider(AdminProjectService)
      .useValue(service)
      .compile();
    const app = module.createNestApplication<INestApplication<App>>();
    await app.init();
    try {
      const body = {
        slug: "p1",
        title: "제목",
        description: "설명",
        image: "",
        stacks: "[]",
        content: "제목·front matter 없이 자유롭게 작성합니다.",
      };
      await request(app.getHttpServer())
        .put("/service/project")
        .send(body)
        .expect(401);
      await request(app.getHttpServer())
        .put("/service/project")
        .set("Authorization", "Bearer fixture-token")
        .send({ ...body, order: 999 })
        .expect(400);
      await request(app.getHttpServer())
        .put("/service/project")
        .set("Authorization", "Bearer fixture-token")
        .send({ ...body, title: 42 })
        .expect(400);
      const result = await request(app.getHttpServer())
        .put("/service/project")
        .set("Authorization", "Bearer fixture-token")
        .send(body)
        .expect(200);
      expect(result.body).toMatchObject({
        operation: "created",
        project: { slug: "p1", isRecent: true },
      });
      expect(service.upsert).toHaveBeenCalledTimes(1);
      expect(service.upsert).toHaveBeenCalledWith(body);
    } finally {
      await app.close();
    }
  });
});
