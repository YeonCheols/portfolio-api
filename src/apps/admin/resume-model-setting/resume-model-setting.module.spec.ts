import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { AdminAuthModule } from "src/apps/admin/auth/auth.module";
import { PrismaModule } from "src/prisma/prisma.module";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminResumeModelSettingModule } from "./resume-model-setting.module";
import { AdminResumeModelSettingService } from "./resume-model-setting.service";

describe("AdminResumeModelSettingModule", () => {
  const originalToken = process.env.MCP_AUTH_SERVICE_TOKEN;
  const originalSecret = process.env.JWT_SECRET;
  const service = { findAll: jest.fn() };
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.MCP_AUTH_SERVICE_TOKEN = "module-service-token";
    process.env.JWT_SECRET = "module-jwt-secret";
    const moduleRef = await Test.createTestingModule({
      // 실제 앱처럼 전역 PrismaModule과 JWT 전략을 제공하는 AdminAuthModule을 함께 구성한다
      imports: [PrismaModule, AdminAuthModule, AdminResumeModelSettingModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ adminUser: { findUnique: jest.fn() } })
      .overrideProvider(AdminResumeModelSettingService)
      .useValue(service)
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (originalToken === undefined) delete process.env.MCP_AUTH_SERVICE_TOKEN;
    else process.env.MCP_AUTH_SERVICE_TOKEN = originalToken;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it("실제 모듈 구성에서 MCP 서비스 토큰은 통과하고 토큰이 없으면 401이다", async () => {
    service.findAll.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get("/admin/resume-model-setting")
      .expect(401);
    await request(app.getHttpServer())
      .get("/admin/resume-model-setting")
      .set({ Authorization: "Bearer module-service-token" })
      .expect(200)
      .expect([]);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});
