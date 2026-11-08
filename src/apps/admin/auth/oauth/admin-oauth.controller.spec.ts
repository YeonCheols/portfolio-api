import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { App } from "supertest/types";
import { AdminOAuthError } from "./admin-oauth";
import { AdminOAuthController } from "./admin-oauth.controller";
import { AdminOAuthService } from "./admin-oauth.service";

describe("AdminOAuthController", () => {
  const originalAppUrl = process.env.ADMIN_APP_URL;
  let app: INestApplication<App>;
  const service = { getAuthorizationUrl: jest.fn(), signIn: jest.fn() };

  beforeAll(async () => {
    process.env.ADMIN_APP_URL = "https://admin.example.com";
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminOAuthController],
      providers: [{ provide: AdminOAuthService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (originalAppUrl === undefined) delete process.env.ADMIN_APP_URL;
    else process.env.ADMIN_APP_URL = originalAppUrl;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service.getAuthorizationUrl.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?state=issued",
      state: "issued-state",
    });
    service.signIn.mockResolvedValue({
      admin: { id: 7, email: "admin@test.com" },
      accessToken: "issued-admin-token",
    });
  });

  describe("GET :provider/authorize", () => {
    it("인증 없이 공급자 시작 주소로 302 이동한다", async () => {
      await request(app.getHttpServer())
        .get("/admin/auth/oauth/google/authorize")
        .expect(302)
        .expect(
          "Location",
          "https://accounts.google.com/o/oauth2/v2/auth?state=issued",
        );

      expect(service.getAuthorizationUrl).toHaveBeenCalledWith("google");
    });

    it("시작한 브라우저에 state를 담은 단기 쿠키를 심는다", async () => {
      const response = await request(app.getHttpServer())
        .get("/admin/auth/oauth/google/authorize")
        .expect(302);

      const cookie = (response.headers["set-cookie"] as unknown as string[])[0];
      expect(cookie).toContain("admin_oauth_state=issued-state");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/admin/auth/oauth");
      expect(cookie).toMatch(/Max-Age=600/);
    });

    it("지원하지 않는 공급자는 404이고 state를 만들지 않는다", async () => {
      await request(app.getHttpServer())
        .get("/admin/auth/oauth/facebook/authorize")
        .expect(404);

      expect(service.getAuthorizationUrl).not.toHaveBeenCalled();
    });
  });

  describe("GET :provider/callback", () => {
    it("성공하면 기존 관리자 쿠키를 심고 관리자 앱 루트로 이동한다", async () => {
      const response = await request(app.getHttpServer())
        .get("/admin/auth/oauth/github/callback?code=c1&state=s1")
        .set("Cookie", "admin_oauth_state=s1")
        .expect(302)
        .expect("Location", "https://admin.example.com/");

      const cookie = (
        response.headers["set-cookie"] as unknown as string[]
      ).find((c) => c.startsWith("access_token="));
      expect(cookie).toContain("access_token=issued-admin-token");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=None");
      expect(cookie).toContain("Domain=.ycseng.com");
      expect(service.signIn).toHaveBeenCalledWith("github", "c1", "s1");
    });

    it.each(["ACCESS_DENIED", "AUTH_FAILED"] as const)(
      "%s 실패는 쿠키 없이 로그인 화면에 코드만 전달한다",
      async (code) => {
        service.signIn.mockRejectedValue(new AdminOAuthError(code));

        const response = await request(app.getHttpServer())
          .get("/admin/auth/oauth/google/callback?code=c1&state=s1")
          .set("Cookie", "admin_oauth_state=s1")
          .expect(302)
          .expect("Location", `https://admin.example.com/login?error=${code}`);

        const cookies = (response.headers["set-cookie"] ??
          []) as unknown as string[];
        expect(cookies.some((c) => c.startsWith("access_token="))).toBe(false);
      },
    );

    it("공급자가 거절을 알리면 state를 소비하지 않고 ACCESS_DENIED로 알린다", async () => {
      await request(app.getHttpServer())
        .get("/admin/auth/oauth/google/callback?error=access_denied&state=s1")
        .expect(302)
        .expect(
          "Location",
          "https://admin.example.com/login?error=ACCESS_DENIED",
        );

      expect(service.signIn).not.toHaveBeenCalled();
    });

    it.each([
      ["code 없음", "?state=s1"],
      ["state 없음", "?code=c1"],
    ])("%s이면 인증을 시도하지 않고 AUTH_FAILED로 알린다", async (_n, qs) => {
      await request(app.getHttpServer())
        .get(`/admin/auth/oauth/google/callback${qs}`)
        .expect(302)
        .expect(
          "Location",
          "https://admin.example.com/login?error=AUTH_FAILED",
        );

      expect(service.signIn).not.toHaveBeenCalled();
    });

    it("리다이렉트 주소에 code·state·토큰을 싣지 않는다", async () => {
      const response = await request(app.getHttpServer())
        .get(
          "/admin/auth/oauth/github/callback?code=secret-code&state=secret-state",
        )
        .set("Cookie", "admin_oauth_state=secret-state")
        .expect(302);

      expect(response.headers.location).not.toMatch(
        /secret-code|secret-state|issued-admin-token/,
      );
    });

    it.each([
      ["state 쿠키가 없으면", undefined],
      ["state 쿠키가 요청의 state와 다르면", "admin_oauth_state=other"],
    ])("%s 인증을 시도하지 않고 AUTH_FAILED로 알린다", async (_n, cookie) => {
      const req = request(app.getHttpServer()).get(
        "/admin/auth/oauth/google/callback?code=c1&state=s1",
      );
      if (cookie) req.set("Cookie", cookie);

      await req
        .expect(302)
        .expect(
          "Location",
          "https://admin.example.com/login?error=AUTH_FAILED",
        );

      expect(service.signIn).not.toHaveBeenCalled();
    });

    it.each(["성공", "실패"])("%s 뒤에는 state 쿠키를 지운다", async (kind) => {
      if (kind === "실패") {
        service.signIn.mockRejectedValue(new AdminOAuthError("ACCESS_DENIED"));
      }

      const response = await request(app.getHttpServer())
        .get("/admin/auth/oauth/google/callback?code=c1&state=s1")
        .set("Cookie", "admin_oauth_state=s1")
        .expect(302);

      const cookies = response.headers["set-cookie"] as unknown as string[];
      const cleared = cookies.find((c) => c.startsWith("admin_oauth_state="));
      expect(cleared).toMatch(/admin_oauth_state=;/);
      expect(cleared).toContain("Path=/admin/auth/oauth");
    });

    it("지원하지 않는 공급자는 404이고 인증을 시도하지 않는다", async () => {
      await request(app.getHttpServer())
        .get("/admin/auth/oauth/facebook/callback?code=c1&state=s1")
        .expect(404);

      expect(service.signIn).not.toHaveBeenCalled();
    });
  });
});
