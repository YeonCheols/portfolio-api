import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { AdminAuthModule } from "src/apps/admin/auth/auth.module";
import { AdminResumeModelSettingModule } from "src/apps/admin/resume-model-setting/resume-model-setting.module";
import { AdminResumeModelSettingService } from "src/apps/admin/resume-model-setting/resume-model-setting.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { PrismaService } from "src/prisma/prisma.service";
import { McpModule } from "../index.module";

describe("McpModule", () => {
  const originalToken = process.env.MCP_AUTH_SERVICE_TOKEN;
  const originalSecret = process.env.JWT_SECRET;
  const service = { findAll: jest.fn() };
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.MCP_AUTH_SERVICE_TOKEN = "module-service-token";
    process.env.JWT_SECRET = "module-jwt-secret";
    const moduleRef = await Test.createTestingModule({
      // 실제 앱처럼 전역 PrismaModule과 관리자 모듈을 함께 구성해 두 영역의 경계를 확인한다
      imports: [
        PrismaModule,
        AdminAuthModule,
        AdminResumeModelSettingModule,
        McpModule,
      ],
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("MCP 경로를 등록하고 실제 서비스 토큰 검증으로 보호한다", async () => {
    service.findAll.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get("/service/resume-model-setting")
      .expect(401);
    await request(app.getHttpServer())
      .get("/service/resume-model-setting")
      .set({ Authorization: "Bearer module-service-token" })
      .expect(200)
      .expect([]);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });

  it("서비스 토큰은 웹앱 관리자 경로에서는 통과하지 못한다", async () => {
    await request(app.getHttpServer())
      .get("/admin/resume-model-setting")
      .set({ Authorization: "Bearer module-service-token" })
      .expect(401);
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
