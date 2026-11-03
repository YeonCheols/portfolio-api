import { INestApplication, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { AdminResumeModelSettingService } from "src/apps/admin/resume-model-setting/resume-model-setting.service";
import { AuthService } from "src/apps/public/auth/auth.service";
import { McpServiceTokenGuard } from "src/apps/public/auth/mcp-service-token.guard";
import { McpResumeModelSettingController } from "./mcp-resume-model-setting.controller";

describe("McpResumeModelSettingController", () => {
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
    remove: jest.fn(),
  };
  const authService = {
    validateServiceToken: jest.fn((_clientId: string, token?: string) => {
      if (token !== "service-token") throw new UnauthorizedException();
    }),
  };
  const auth = () => ({ Authorization: "Bearer service-token" });
  const body = {
    environment: "production",
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: "fake-provider-api-key",
  };
  const visible = {
    environment: body.environment,
    provider: body.provider,
    modelName: body.modelName,
    url: body.url,
    hasApiKey: true,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [McpResumeModelSettingController],
      providers: [
        McpServiceTokenGuard,
        { provide: AuthService, useValue: authService },
        { provide: AdminResumeModelSettingService, useValue: service },
      ],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("서비스 토큰으로 목록을 조회하면 설정 서비스 결과를 반환한다", async () => {
    service.findAll.mockResolvedValue([{ id: 1, ...visible, isActive: true }]);

    await request(app.getHttpServer())
      .get("/service/resume-model-setting")
      .set(auth())
      .expect(200)
      .expect([{ id: 1, ...visible, isActive: true }]);
    expect(authService.validateServiceToken).toHaveBeenCalledWith(
      "mcp",
      "service-token",
    );
  });

  it("서비스 토큰으로 생성하면 201과 저장한 설정을 반환한다", async () => {
    service.create.mockResolvedValue({ id: 1, ...visible, isActive: false });

    await request(app.getHttpServer())
      .post("/service/resume-model-setting")
      .set(auth())
      .send(body)
      .expect(201)
      .expect({ id: 1, ...visible, isActive: false });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it("서비스 토큰으로 수정하면 id와 본문을 서비스에 전달한다", async () => {
    service.update.mockResolvedValue({ id: 3, ...visible, isActive: false });

    await request(app.getHttpServer())
      .put("/service/resume-model-setting/3")
      .set(auth())
      .send(body)
      .expect(200)
      .expect({ id: 3, ...visible, isActive: false });
    expect(service.update).toHaveBeenCalledWith(3, body);
  });

  it("서비스 토큰으로 활성화하면 200과 활성화된 설정을 반환한다", async () => {
    service.activate.mockResolvedValue({ id: 3, ...visible, isActive: true });

    await request(app.getHttpServer())
      .post("/service/resume-model-setting/3/activate")
      .set(auth())
      .expect(200)
      .expect({ id: 3, ...visible, isActive: true });
    expect(service.activate).toHaveBeenCalledWith(3);
  });

  it("서비스 토큰으로 삭제하면 삭제한 설정을 반환한다", async () => {
    service.remove.mockResolvedValue({ id: 3, ...visible, isActive: false });

    await request(app.getHttpServer())
      .delete("/service/resume-model-setting/3")
      .set(auth())
      .expect(200)
      .expect({ id: 3, ...visible, isActive: false });
    expect(service.remove).toHaveBeenCalledWith(3);
  });

  it("토큰이 없거나 틀리면 모든 경로가 401이고 서비스를 호출하지 않는다", async () => {
    const server = app.getHttpServer();
    const wrong = { Authorization: "Bearer wrong-token" };

    for (const headers of [{}, wrong]) {
      await request(server)
        .get("/service/resume-model-setting")
        .set(headers)
        .expect(401);
      await request(server)
        .post("/service/resume-model-setting")
        .set(headers)
        .send(body)
        .expect(401);
      await request(server)
        .put("/service/resume-model-setting/1")
        .set(headers)
        .send(body)
        .expect(401);
      await request(server)
        .post("/service/resume-model-setting/1/activate")
        .set(headers)
        .expect(401);
      await request(server)
        .delete("/service/resume-model-setting/1")
        .set(headers)
        .expect(401);
    }

    expect(service.findAll).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.activate).not.toHaveBeenCalled();
    expect(service.remove).not.toHaveBeenCalled();
  });
});
