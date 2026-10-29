import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { App } from "supertest/types";
import {
  createAdminAuthTestApp,
  restoreJwtSecret,
  signTestAdminToken,
  TEST_JWT_SECRET,
} from "../auth/testing/admin-auth-test-app";
import { AdminProjectController } from "./project.controller";
import { AdminProjectService } from "./project.service";

describe("AdminProjectController 인증", () => {
  const originalSecret = process.env.JWT_SECRET;
  let app: INestApplication<App>;
  const service = {
    create: jest.fn().mockResolvedValue({}),
    findAll: jest.fn().mockResolvedValue([]),
    finedSearch: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
    findOverSlug: jest.fn().mockResolvedValue({}),
    updateOrder: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    updateShow: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    app = await createAdminAuthTestApp(AdminProjectController, [
      { provide: AdminProjectService, useValue: service },
    ]);
  });

  afterAll(async () => {
    await app.close();
    restoreJwtSecret(originalSecret);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["post", "/admin/project"],
    ["get", "/admin/project"],
    ["get", "/admin/project/search"],
    ["get", "/admin/project/sample"],
    ["get", "/admin/project/over-slug/sample"],
    ["patch", "/admin/project/order"],
    ["patch", "/admin/project/sample"],
    ["patch", "/admin/project/sample/show"],
    ["delete", "/admin/project/sample"],
  ] as const)(
    "토큰 없이 %s %s를 호출하면 401을 반환하고 서비스를 호출하지 않는다",
    async (method, path) => {
      await request(app.getHttpServer())[method](path).expect(401);

      Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    },
  );

  it("유효한 관리자 토큰으로 목록을 조회하면 서비스 결과를 반환한다", async () => {
    service.findAll.mockResolvedValue([{ slug: "sample" }]);

    await request(app.getHttpServer())
      .get("/admin/project")
      .set("Authorization", `Bearer ${signTestAdminToken()}`)
      .expect(200)
      .expect([{ slug: "sample" }]);
  });

  it("다른 키로 서명한 토큰으로 호출하면 401을 반환한다", async () => {
    await request(app.getHttpServer())
      .get("/admin/project")
      .set("Authorization", `Bearer ${signTestAdminToken("other-secret")}`)
      .expect(401);

    expect(service.findAll).not.toHaveBeenCalled();
  });
});
