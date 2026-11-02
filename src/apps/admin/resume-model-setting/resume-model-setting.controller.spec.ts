import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { App } from "supertest/types";
import {
  createAdminAuthTestApp,
  restoreJwtSecret,
  signTestAdminToken,
  TEST_JWT_SECRET,
} from "../auth/testing/admin-auth-test-app";
import { AdminResumeModelSettingController } from "./resume-model-setting.controller";
import { AdminResumeModelSettingService } from "./resume-model-setting.service";

describe("AdminResumeModelSettingController", () => {
  const originalSecret = process.env.JWT_SECRET;
  let app: INestApplication<App>;
  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
    remove: jest.fn(),
  };
  const body = {
    environment: "production",
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    secretRef: "RESUME_MODEL_TOKEN_OPENROUTER",
  };
  const auth = () => ({ Authorization: `Bearer ${signTestAdminToken()}` });

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    app = await createAdminAuthTestApp(AdminResumeModelSettingController, [
      { provide: AdminResumeModelSettingService, useValue: service },
    ]);
  });

  afterAll(async () => {
    await app.close();
    restoreJwtSecret(originalSecret);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("관리자 토큰으로 생성하면 201과 저장한 설정을 반환한다", async () => {
    service.create.mockResolvedValue({ id: 1, ...body, isActive: false });

    await request(app.getHttpServer())
      .post("/admin/resume-model-setting")
      .set(auth())
      .send(body)
      .expect(201)
      .expect({ id: 1, ...body, isActive: false });
    expect(service.create).toHaveBeenCalledWith(body);
  });

  it("관리자 토큰으로 목록을 조회하면 서비스 결과를 반환한다", async () => {
    service.findAll.mockResolvedValue([{ id: 1, ...body, isActive: true }]);

    await request(app.getHttpServer())
      .get("/admin/resume-model-setting")
      .set(auth())
      .expect(200)
      .expect([{ id: 1, ...body, isActive: true }]);
  });

  it("관리자 토큰으로 수정하면 숫자 id와 본문을 서비스에 넘긴다", async () => {
    service.update.mockResolvedValue({ id: 3 });

    await request(app.getHttpServer())
      .put("/admin/resume-model-setting/3")
      .set(auth())
      .send(body)
      .expect(200)
      .expect({ id: 3 });
    expect(service.update).toHaveBeenCalledWith(3, body);

    await request(app.getHttpServer())
      .put("/admin/resume-model-setting/abc")
      .set(auth())
      .send(body)
      .expect(400);
    expect(service.update).toHaveBeenCalledTimes(1);
  });

  it("관리자 토큰으로 활성화하면 200과 활성화한 설정을 반환한다", async () => {
    service.activate.mockResolvedValue({ id: 3, isActive: true });

    await request(app.getHttpServer())
      .post("/admin/resume-model-setting/3/activate")
      .set(auth())
      .expect(200)
      .expect({ id: 3, isActive: true });
    expect(service.activate).toHaveBeenCalledWith(3);
  });

  it("관리자 토큰으로 삭제하면 서비스에 숫자 id를 넘긴다", async () => {
    service.remove.mockResolvedValue({ id: 3 });

    await request(app.getHttpServer())
      .delete("/admin/resume-model-setting/3")
      .set(auth())
      .expect(200)
      .expect({ id: 3 });
    expect(service.remove).toHaveBeenCalledWith(3);
  });

  describe.each([
    ["토큰 없이", undefined],
    ["조회 전용 Bearer로", "Bearer resume-model-setting-read-token"],
  ])("%s 호출하면", (_label, authorization) => {
    it.each([
      ["get", "/admin/resume-model-setting"],
      ["post", "/admin/resume-model-setting"],
      ["put", "/admin/resume-model-setting/1"],
      ["post", "/admin/resume-model-setting/1/activate"],
      ["delete", "/admin/resume-model-setting/1"],
    ] as const)(
      "%s %s는 401을 반환하고 서비스를 호출하지 않는다",
      async (method, path) => {
        const req = request(app.getHttpServer())[method](path);
        if (authorization) req.set("Authorization", authorization);
        await req.send(body).expect(401);

        Object.values(service).forEach((fn) =>
          expect(fn).not.toHaveBeenCalled(),
        );
      },
    );
  });
});
