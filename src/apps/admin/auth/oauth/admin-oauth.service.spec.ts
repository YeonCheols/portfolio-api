import * as jwt from "jsonwebtoken";
import { UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminOAuthError } from "./admin-oauth";
import { AdminOAuthService } from "./admin-oauth.service";

const json = (body: unknown, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
  }) as Response;

describe("AdminOAuthService", () => {
  const env = { ...process.env };
  const prisma = {
    adminUser: { findFirst: jest.fn() },
    authHistory: { updateMany: jest.fn() },
  };
  const oauthState = { issue: jest.fn(), consume: jest.fn() };
  const fetchMock = jest.fn();
  let service: AdminOAuthService;
  const admin = { id: 7, email: "admin@test.com", isActive: true };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.ADMIN_GOOGLE_OAUTH_CLIENT_ID = "google-client";
    process.env.ADMIN_GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
    process.env.ADMIN_GOOGLE_REDIRECT_URI =
      "https://api.example.com/admin/auth/oauth/google/callback";
    process.env.ADMIN_GITHUB_OAUTH_CLIENT_ID = "github-client";
    process.env.ADMIN_GITHUB_OAUTH_CLIENT_SECRET = "github-secret";
    process.env.ADMIN_GITHUB_REDIRECT_URI =
      "https://api.example.com/admin/auth/oauth/github/callback";
    oauthState.issue.mockResolvedValue("issued-state");
    oauthState.consume.mockResolvedValue({ id: "history-1" });
    prisma.adminUser.findFirst.mockResolvedValue(admin);
    prisma.authHistory.updateMany.mockResolvedValue({ count: 1 });
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new AdminOAuthService(
      prisma as unknown as PrismaService,
      oauthState as never,
    );
  });

  afterAll(() => {
    process.env = env;
  });

  describe("getAuthorizationUrl", () => {
    it("Google은 이메일 범위와 일회용 state가 담긴 시작 주소를 만든다", async () => {
      const result = await service.getAuthorizationUrl("google");
      const url = new URL(result.url);
      expect(result.state).toBe("issued-state");

      expect(url.origin + url.pathname).toBe(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        client_id: "google-client",
        redirect_uri: process.env.ADMIN_GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: "openid email",
        state: "issued-state",
      });
      expect(url.searchParams.get("client_secret")).toBeNull();
      expect(oauthState.issue).toHaveBeenCalledWith(
        "admin",
        process.env.ADMIN_GOOGLE_REDIRECT_URI,
      );
    });

    it("GitHub는 검증된 이메일을 읽을 수 있는 범위로 시작한다", async () => {
      const url = new URL((await service.getAuthorizationUrl("github")).url);

      expect(url.origin + url.pathname).toBe(
        "https://github.com/login/oauth/authorize",
      );
      expect(url.searchParams.get("scope")).toBe("user:email");
      expect(url.searchParams.get("state")).toBe("issued-state");
    });

    it("공급자 설정이 없으면 state를 만들지 않고 실패한다", async () => {
      delete process.env.ADMIN_GOOGLE_OAUTH_CLIENT_ID;

      await expect(service.getAuthorizationUrl("google")).rejects.toThrow(
        "ADMIN_GOOGLE_OAUTH_CLIENT_ID",
      );
      expect(oauthState.issue).not.toHaveBeenCalled();
    });
  });

  describe("signIn (Google)", () => {
    const google = (profile: Record<string, unknown>) => {
      fetchMock
        .mockResolvedValueOnce(json({ access_token: "provider-access" }))
        .mockResolvedValueOnce(json(profile));
    };

    it("검증된 이메일이 활성 관리자와 같으면 기존 관리자 토큰을 발급한다", async () => {
      google({ email: "admin@test.com", email_verified: true });

      const result = await service.signIn("google", "code-1", "state-1");

      expect(oauthState.consume).toHaveBeenCalledWith("state-1", "admin");
      expect(result.admin).toEqual({ id: 7, email: "admin@test.com" });
      expect(jwt.verify(result.accessToken, "test-secret")).toMatchObject({
        sub: 7,
        email: "admin@test.com",
      });
      const tokenCall = fetchMock.mock.calls[0];
      expect(tokenCall[0]).toBe("https://oauth2.googleapis.com/token");
      const form = new URLSearchParams(tokenCall[1].body as string);
      expect(Object.fromEntries(form)).toMatchObject({
        code: "code-1",
        client_id: "google-client",
        client_secret: "google-secret",
        grant_type: "authorization_code",
        redirect_uri: process.env.ADMIN_GOOGLE_REDIRECT_URI,
      });
    });

    it("이메일 대소문자가 달라도 같은 관리자로 판정한다", async () => {
      google({ email: "Admin@Test.com", email_verified: true });

      await service.signIn("google", "code-1", "state-1");

      // 대소문자 처리는 DB 조회의 insensitive 모드가 맡는다
      expect(prisma.adminUser.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: "Admin@Test.com", mode: "insensitive" } },
      });
    });

    it.each([
      [
        "이메일이 검증되지 않은 계정",
        { email: "admin@test.com", email_verified: false },
      ],
      ["이메일 검증 여부가 없는 계정", { email: "admin@test.com" }],
      ["이메일이 없는 계정", { email_verified: true }],
    ])("%s은 관리자를 조회하지 않고 거절한다", async (_name, profile) => {
      google(profile);

      await expect(
        service.signIn("google", "code-1", "state-1"),
      ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
      expect(prisma.adminUser.findFirst).not.toHaveBeenCalled();
    });

    it("등록되지 않은 이메일은 거절한다", async () => {
      google({ email: "stranger@test.com", email_verified: true });
      prisma.adminUser.findFirst.mockResolvedValue(null);

      await expect(
        service.signIn("google", "code-1", "state-1"),
      ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    });

    it("비활성 관리자는 거절한다", async () => {
      google({ email: "admin@test.com", email_verified: true });
      prisma.adminUser.findFirst.mockResolvedValue({
        ...admin,
        isActive: false,
      });

      await expect(
        service.signIn("google", "code-1", "state-1"),
      ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    });
  });

  describe("signIn (GitHub)", () => {
    const github = (emails: unknown, emailsOk = true) => {
      fetchMock
        .mockResolvedValueOnce(json({ access_token: "provider-access" }))
        .mockResolvedValueOnce(json(emails, emailsOk));
    };

    it("기본이면서 검증된 이메일만 관리자 판정에 쓴다", async () => {
      github([
        { email: "other@test.com", primary: false, verified: true },
        { email: "unverified@test.com", primary: true, verified: false },
        { email: "admin@test.com", primary: true, verified: true },
      ]);

      const result = await service.signIn("github", "code-1", "state-1");

      expect(result.admin.id).toBe(7);
      expect(prisma.adminUser.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: "admin@test.com", mode: "insensitive" } },
      });
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://github.com/login/oauth/access_token",
      );
      expect(fetchMock.mock.calls[1][0]).toBe(
        "https://api.github.com/user/emails",
      );
    });

    it("기본이면서 검증된 이메일이 없으면 거절한다", async () => {
      github([{ email: "admin@test.com", primary: true, verified: false }]);

      await expect(
        service.signIn("github", "code-1", "state-1"),
      ).rejects.toMatchObject({ code: "ACCESS_DENIED" });
      expect(prisma.adminUser.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("실패 처리", () => {
    it("잘못되었거나 이미 쓴 state는 공급자를 호출하지 않고 AUTH_FAILED로 거절한다", async () => {
      oauthState.consume.mockRejectedValue(new UnauthorizedException());

      await expect(
        service.signIn("google", "code-1", "bad-state"),
      ).rejects.toMatchObject({ code: "AUTH_FAILED" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("토큰 교환이 실패하면 AUTH_FAILED로 거절하고 기록을 실패로 표시한다", async () => {
      fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant" }, false));

      await expect(
        service.signIn("google", "bad-code", "state-1"),
      ).rejects.toMatchObject({ code: "AUTH_FAILED" });
      expect(prisma.authHistory.updateMany).toHaveBeenCalledWith({
        where: { id: "history-1", status: "pending" },
        data: { status: "failed" },
      });
    });

    it("네트워크 오류도 AUTH_FAILED로 바꾸고 토큰이나 원문을 담지 않는다", async () => {
      fetchMock.mockRejectedValueOnce(
        new Error("connect ECONNRESET secret-token-value"),
      );

      const error = await service
        .signIn("google", "code-1", "state-1")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AdminOAuthError);
      expect(error).toMatchObject({ code: "AUTH_FAILED" });
      expect(String((error as Error).message)).not.toContain("secret");
    });
  });
});
