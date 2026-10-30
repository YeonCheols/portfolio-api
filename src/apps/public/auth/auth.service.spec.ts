import { generateKeyPairSync } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { decode, verify } from "jsonwebtoken";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;
  const prisma = {
    authHistory: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(
      (operation: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[]) =>
        Array.isArray(operation) ? Promise.all(operation) : operation(prisma),
    ),
  };
  const userIdentity = { resolveGitHubUser: jest.fn() };
  const makePendingHistory = (clientId: "portfolio" | "mcp") => ({
    id: `${clientId}-history`,
    clientId,
    userId: null,
    redirectUri:
      process.env[
        clientId === "mcp"
          ? "MCP_GITHUB_REDIRECT_URI"
          : "PORTFOLIO_GITHUB_REDIRECT_URI"
      ],
    stateConsumedAt: null,
    stateExpiresAt: new Date(Date.now() + 60_000),
    status: "pending",
  });

  beforeEach(() => {
    process.env.MCP_GITHUB_REDIRECT_URI =
      "https://mcp.example.com/github/callback";
    process.env.GITHUB_OAUTH_CLIENT_ID = "mcp-client-id";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "mcp-client-secret";
    process.env.MCP_AUTHORIZED_GITHUB_USER_IDS = "123";
    process.env.MCP_RESOURCE_URL = "https://mcp.example.com";
    process.env.MCP_AUTH_SERVICE_TOKEN = "mcp-service-secret";
    process.env.PORTFOLIO_GITHUB_REDIRECT_URI =
      "https://portfolio.example.com/auth/callback";
    process.env.PORTFOLIO_GITHUB_OAUTH_CLIENT_ID = "portfolio-client-id";
    process.env.PORTFOLIO_GITHUB_OAUTH_CLIENT_SECRET =
      "portfolio-client-secret";
    process.env.PORTFOLIO_AUTHORIZED_GITHUB_USER_IDS = "123";
    process.env.PORTFOLIO_AUTH_AUDIENCE = "https://portfolio.example.com";
    process.env.PORTFOLIO_AUTH_SERVICE_TOKEN = "portfolio-service-secret";
    process.env.AUTH_ISSUER = "https://api.example.com/auth";
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      userIdentity as never,
    );
  });

  it("앱별 서버 자격 증명을 분리해 검증한다", () => {
    expect(() =>
      service.validateServiceToken("mcp", "mcp-service-secret"),
    ).not.toThrow();
    expect(() =>
      service.validateServiceToken("portfolio", "portfolio-service-secret"),
    ).not.toThrow();
    expect(() =>
      service.validateServiceToken("mcp", "portfolio-service-secret"),
    ).toThrow(UnauthorizedException);
  });

  it("AuthHistory에 OAuth 대기 상태와 앱 정보를 기록한다", async () => {
    const result = await service.createOAuthState("portfolio");
    const url = new URL(result.authorizationUrl);
    expect(url.searchParams.get("client_id")).toBe("portfolio-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      process.env.PORTFOLIO_GITHUB_REDIRECT_URI,
    );
    expect(prisma.authHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "portfolio",
          userId: null,
          status: "pending",
          redirectUri: process.env.PORTFOLIO_GITHUB_REDIRECT_URI,
          stateHash: expect.not.stringContaining(result.state),
        }),
      }),
    );
  });

  it("MCP 인증 성공을 AuthHistory에 기록하고 refresh token 이력을 UserToken에 저장한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.AUTH_PRIVATE_KEY = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    prisma.authHistory.findUnique.mockResolvedValue(makePendingHistory("mcp"));
    prisma.authHistory.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.userToken.create.mockResolvedValue({ id: "refresh-row" });
    userIdentity.resolveGitHubUser.mockResolvedValue({ id: 42 });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "github-access" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123, name: "User" }),
      }) as unknown as typeof fetch;

    const tokens = await service.exchangeGitHubCode("mcp", "code", "state");
    const claims = verify(
      tokens.access_token,
      keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      {
        algorithms: ["RS256"],
        issuer: process.env.AUTH_ISSUER,
        audience: process.env.MCP_RESOURCE_URL,
      },
    ) as { scope: string; exp: number; iat: number };
    const activation = prisma.authHistory.updateMany.mock.calls[1][0];

    expect(claims.scope).toBe("resume:use");
    expect(claims.exp - claims.iat).toBe(3600);
    expect(activation.data).toEqual(
      expect.objectContaining({
        userId: 42,
        status: "authenticated",
        scope: "resume:use",
      }),
    );
    expect(prisma.userToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authHistoryId: "mcp-history",
          tokenHash: expect.not.stringContaining(tokens.refresh_token),
        }),
      }),
    );
    expect(decode(tokens.access_token, { complete: true })?.header.kid).toBe(
      service.getJwks().keys[0].kid,
    );
  });

  it("portfolio 로그인도 같은 사용자 identity를 쓰되 권한과 audience를 분리한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.AUTH_PRIVATE_KEY = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    prisma.authHistory.findUnique.mockResolvedValue(
      makePendingHistory("portfolio"),
    );
    prisma.authHistory.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.userToken.create.mockResolvedValue({ id: "portfolio-refresh" });
    userIdentity.resolveGitHubUser.mockResolvedValue({ id: 42 });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "github-access" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 123 }),
      }) as unknown as typeof fetch;

    const tokens = await service.exchangeGitHubCode(
      "portfolio",
      "code",
      "portfolio-state",
    );
    const claims = verify(
      tokens.access_token,
      keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      {
        algorithms: ["RS256"],
        issuer: process.env.AUTH_ISSUER,
        audience: process.env.PORTFOLIO_AUTH_AUDIENCE,
      },
    ) as { scope: string };

    expect(claims.scope).toBe("portfolio:use");
    expect(prisma.authHistory.updateMany.mock.calls[1][0].data).toEqual(
      expect.objectContaining({
        audience: process.env.PORTFOLIO_AUTH_AUDIENCE,
        scope: "portfolio:use",
      }),
    );
    expect(userIdentity.resolveGitHubUser).toHaveBeenCalledWith(
      expect.objectContaining({ providerUserId: "123" }),
    );
  });

  it("다른 앱의 OAuth state는 소비하지 않는다", async () => {
    prisma.authHistory.findUnique.mockResolvedValue(
      makePendingHistory("portfolio"),
    );
    await expect(service.consumeOAuthState("state", "mcp")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.authHistory.updateMany).not.toHaveBeenCalled();
  });

  it("refresh token을 UserToken에 회전 이력으로 저장하고 AuthHistory 만료를 연장한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.AUTH_PRIVATE_KEY = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    prisma.userToken.findUnique.mockResolvedValue({
      id: "token-1",
      authHistoryId: "mcp-history",
      tokenHash: "old-hash",
      consumedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      authHistory: {
        id: "mcp-history",
        clientId: "mcp",
        userId: 42,
        audience: "https://mcp.example.com",
        scope: "resume:use",
        status: "authenticated",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      },
    });
    prisma.userToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.userToken.create.mockResolvedValue({ id: "token-2" });
    prisma.authHistory.update.mockResolvedValue({});

    const tokens = await service.refresh("mcp", "old-refresh-token");
    expect(prisma.userToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "token-1", consumedAt: null }),
      }),
    );
    expect(prisma.userToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authHistoryId: "mcp-history",
          tokenHash: expect.not.stringContaining(tokens.refresh_token),
        }),
      }),
    );
    expect(prisma.authHistory.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mcp-history" } }),
    );
  });

  it("소비된 refresh token을 재사용하면 인증 이력과 발급 토큰을 폐기한다", async () => {
    prisma.userToken.findUnique.mockResolvedValue({
      id: "old-token",
      authHistoryId: "mcp-history",
      consumedAt: new Date(),
      revokedAt: null,
      authHistory: {
        id: "mcp-history",
        clientId: "mcp",
        status: "authenticated",
      },
    });
    prisma.authHistory.updateMany.mockResolvedValue({ count: 1 });
    prisma.userToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.refresh("mcp", "replayed-token")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.authHistory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "revoked" }),
      }),
    );
    expect(prisma.userToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authHistoryId: "mcp-history", revokedAt: null },
      }),
    );
  });

  it("다른 앱 세션의 refresh token은 거부한다", async () => {
    prisma.userToken.findUnique.mockResolvedValue({
      id: "token-1",
      authHistoryId: "mcp-history",
      consumedAt: null,
      revokedAt: null,
      authHistory: { id: "mcp-history", clientId: "mcp" },
    });
    await expect(service.refresh("portfolio", "mcp-token")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.userToken.updateMany).not.toHaveBeenCalled();
  });
});
