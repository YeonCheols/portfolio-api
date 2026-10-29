import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { App } from "supertest/types";
import {
  createAdminAuthTestApp,
  restoreJwtSecret,
  signTestAdminToken,
  TEST_JWT_SECRET,
} from "../auth/testing/admin-auth-test-app";
import { AdminTagController } from "./tag.controller";
import { AdminTagService } from "./tag.service";

describe("AdminTagController 인증", () => {
  const originalSecret = process.env.JWT_SECRET;
  let app: INestApplication<App>;
  const service = {
    findAll: jest.fn().mockResolvedValue([]),
    findSearch: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    app = await createAdminAuthTestApp(AdminTagController, [
      { provide: AdminTagService, useValue: service },
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
    ["get", "/admin/tag"],
    ["get", "/admin/tag/search"],
    ["post", "/admin/tag"],
    ["get", "/admin/tag/react"],
    ["put", "/admin/tag/react"],
    ["delete", "/admin/tag/react"],
  ] as const)(
    "토큰 없이 %s %s를 호출하면 401을 반환하고 서비스를 호출하지 않는다",
    async (method, path) => {
      await request(app.getHttpServer())[method](path).expect(401);

      Object.values(service).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    },
  );

  it("유효한 관리자 토큰으로 목록을 조회하면 서비스 결과를 반환한다", async () => {
    service.findAll.mockResolvedValue([{ name: "react" }]);

    await request(app.getHttpServer())
      .get("/admin/tag")
      .set("Authorization", `Bearer ${signTestAdminToken()}`)
      .expect(200)
      .expect([{ name: "react" }]);
  });
});
