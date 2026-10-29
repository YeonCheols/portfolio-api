import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { App } from "supertest/types";
import {
  createAdminAuthTestApp,
  restoreJwtSecret,
  TEST_JWT_SECRET,
} from "../auth/testing/admin-auth-test-app";
import { AdminUserController } from "./user.controller";
import { AdminUserService } from "./user.service";

describe("AdminUserController 인증", () => {
  const originalSecret = process.env.JWT_SECRET;
  let app: INestApplication<App>;
  const service = {
    create: jest.fn().mockResolvedValue({ id: 2, email: "new@test.com" }),
    login: jest.fn(),
    resetPassword: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    app = await createAdminAuthTestApp(AdminUserController, [
      { provide: AdminUserService, useValue: service },
    ]);
  });

  afterAll(async () => {
    await app.close();
    restoreJwtSecret(originalSecret);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("토큰 없이 관리자 가입을 호출하면 401을 반환하고 계정을 만들지 않는다", async () => {
    await request(app.getHttpServer())
      .post("/admin/user/join")
      .send({ email: "new@test.com", password: "password123" })
      .expect(401);

    expect(service.create).not.toHaveBeenCalled();
  });

  it("토큰 없이 비밀번호 재설정을 호출하면 401을 반환하고 비밀번호를 바꾸지 않는다", async () => {
    await request(app.getHttpServer())
      .post("/admin/user/reset-password")
      .send({ email: "admin@test.com", newPassword: "changed123" })
      .expect(401);

    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it("토큰 없이 로그인을 호출하면 인증 없이 사용자 정보를 반환한다", async () => {
    service.login.mockResolvedValue({
      user: { id: 1, email: "admin@test.com" },
      accessToken: "issued-token",
    });

    await request(app.getHttpServer())
      .post("/admin/user/login")
      .send({ email: "admin@test.com", password: "password123" })
      .expect(201)
      .expect({ user: { id: 1, email: "admin@test.com" } });

    expect(service.login).toHaveBeenCalledTimes(1);
  });
});
