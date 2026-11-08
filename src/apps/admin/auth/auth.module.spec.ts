import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { PrismaModule } from "src/prisma/prisma.module";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminAuthModule } from "./auth.module";

describe("AdminAuthModule OAuth 연결", () => {
  const original = { ...process.env };
  const prisma = {
    adminUser: { findUnique: jest.fn() },
    authHistory: { deleteMany: jest.fn(), create: jest.fn() },
  };
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_SECRET = "module-jwt-secret";
    process.env.ADMIN_APP_URL = "https://admin.example.com";
    process.env.ADMIN_GOOGLE_OAUTH_CLIENT_ID = "google-client";
    process.env.ADMIN_GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
    process.env.ADMIN_GOOGLE_REDIRECT_URI =
      "https://api.example.com/admin/auth/oauth/google/callback";
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, AdminAuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    process.env = original;
  });

  it("관리자 인증 없이 Google 시작 주소로 이동하고 state를 저장한다", async () => {
    const response = await request(app.getHttpServer())
      .get("/admin/auth/oauth/google/authorize")
      .expect(302);

    const location = new URL(response.headers.location);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("state")).toEqual(expect.any(String));
    expect(prisma.authHistory.create).toHaveBeenCalledTimes(1);
    expect(prisma.authHistory.create.mock.calls[0][0].data.clientId).toBe(
      "admin",
    );
  });
});
