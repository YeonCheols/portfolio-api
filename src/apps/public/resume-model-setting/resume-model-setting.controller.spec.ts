import { INestApplication, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { signTestAdminToken } from "src/apps/admin/auth/testing/admin-auth-test-app";
import { ResumeModelSettingController } from "./resume-model-setting.controller";
import { ResumeModelSettingService } from "./resume-model-setting.service";

describe("ResumeModelSettingController", () => {
  const originalToken = process.env.RESUME_MODEL_SETTING_TOKEN;
  let app: INestApplication<App>;
  const service = { findActive: jest.fn() };
  const active = {
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    secretRef: "RESUME_MODEL_TOKEN_OPENROUTER",
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ResumeModelSettingController],
      providers: [{ provide: ResumeModelSettingService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESUME_MODEL_SETTING_TOKEN = "read-token";
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.RESUME_MODEL_SETTING_TOKEN;
      return;
    }
    process.env.RESUME_MODEL_SETTING_TOKEN = originalToken;
  });

  it("조회 토큰으로 활성 설정을 조회하면 네 필드만 반환한다", async () => {
    service.findActive.mockResolvedValue(active);

    const res = await request(app.getHttpServer())
      .get("/resume-model-setting/active")
      .query({ environment: "production" })
      .set("Authorization", "Bearer read-token")
      .expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body).toEqual(active);
    expect(Object.keys(body).sort()).toEqual([
      "modelName",
      "provider",
      "secretRef",
      "url",
    ]);
    expect(service.findActive).toHaveBeenCalledWith("production");
  });

  it.each([
    ["토큰이 없으면", undefined, "read-token"],
    ["토큰이 틀리면", "Bearer wrong-token", "read-token"],
    ["관리자 JWT이면", `Bearer ${signTestAdminToken()}`, "read-token"],
    ["서버 조회 토큰이 없으면", "Bearer read-token", undefined],
  ])(
    "%s 401을 반환하고 조회하지 않는다",
    async (_label, authorization, serverToken) => {
      if (serverToken === undefined) {
        delete process.env.RESUME_MODEL_SETTING_TOKEN;
      }
      const req = request(app.getHttpServer())
        .get("/resume-model-setting/active")
        .query({ environment: "production" });
      if (authorization) req.set("Authorization", authorization);

      await req.expect(401);
      expect(service.findActive).not.toHaveBeenCalled();
    },
  );

  it("활성 설정이 없으면 서비스의 404를 그대로 반환한다", async () => {
    service.findActive.mockRejectedValue(
      new NotFoundException("production 환경의 활성 모델 설정이 없습니다."),
    );

    await request(app.getHttpServer())
      .get("/resume-model-setting/active")
      .query({ environment: "production" })
      .set("Authorization", "Bearer read-token")
      .expect(404);
  });
});
