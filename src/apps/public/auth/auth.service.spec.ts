import { createHash, generateKeyPairSync } from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { decode, sign as signJwt, verify } from "jsonwebtoken";
import { PrismaService } from "src/prisma/prisma.service";
import { OAuthStateService } from "src/apps/identity/oauth-state.service";
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
      new OAuthStateService(prisma as unknown as PrismaService),
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

  it("MCP OAuth 표준 metadata에서 portfolio-api endpoint를 제공한다", () => {
    expect(service.getOAuthMetadata()).toMatchObject({
      issuer: "https://api.example.com/auth",
      authorization_endpoint: "https://api.example.com/auth/authorize",
      token_endpoint: "https://api.example.com/auth/token",
      registration_endpoint: "https://api.example.com/auth/register",
      revocation_endpoint: "https://api.example.com/auth/oauth/revoke",
      jwks_uri: "https://api.example.com/auth/.well-known/jwks.json",
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["resume:use", "project:write"],
      grant_types_supported: [
        "authorization_code",
        "refresh_token",
        "client_credentials",
      ],
      token_endpoint_auth_methods_supported: [
        "none",
        "client_secret_basic",
        "client_secret_post",
      ],
    });
  });

  it("loopback redirect URI를 가진 공개 OAuth client를 등록한다", () => {
    expect(
      service.registerOAuthClient({
        redirect_uris: ["http://127.0.0.1:43123/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        client_name: "MCP test client",
      }),
    ).toMatchObject({
      client_id: expect.any(String),
      redirect_uris: ["http://127.0.0.1:43123/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_name: "MCP test client",
    });
  });

  it("유효한 PKCE 요청을 저장하고 portfolio-api GitHub 로그인 URL을 만든다", async () => {
    prisma.authHistory.create.mockResolvedValue({ id: "oauth-history" });
    const client = service.registerOAuthClient({
      redirect_uris: ["http://127.0.0.1:43123/callback"],
      grant_types: ["authorization_code", "refresh_token"],
    });

    const result = await service.startMcpOAuthAuthorization({
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:43123/callback",
      state: "client-state-123",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
      resource: "https://mcp.example.com",
      scope: "resume:use",
    });

    const loginUrl = new URL(result.authorizationUrl);
    expect(loginUrl.origin).toBe("https://github.com");
    expect(loginUrl.pathname).toBe("/login/oauth/authorize");
    expect(loginUrl.searchParams.get("redirect_uri")).toBe(
      "https://mcp.example.com/github/callback",
    );
    expect(loginUrl.searchParams.get("state")).toEqual(expect.any(String));
    expect(prisma.authHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "mcp",
          oauthClientId: client.client_id,
          oauthRedirectUri: "http://127.0.0.1:43123/callback",
          oauthState: "client-state-123",
          codeChallenge: "A".repeat(43),
          audience: "https://mcp.example.com",
          scope: "resume:use",
          status: "pending",
        }),
      }),
    );
  });

  it("허용된 GitHub callback은 OAuth client state와 authorization code로 돌아간다", async () => {
    const client = service.registerOAuthClient({
      redirect_uris: ["http://127.0.0.1:43123/callback"],
      grant_types: ["authorization_code", "refresh_token"],
    });
    const authorization = await service.startMcpOAuthAuthorization({
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:43123/callback",
      state: "client-state-123",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
      resource: "https://mcp.example.com",
      scope: "resume:use",
    });
    const githubState = new URL(
      authorization.authorizationUrl,
    ).searchParams.get("state");
    if (!githubState) throw new Error("GitHub OAuth state missing");
    prisma.authHistory.findUnique.mockResolvedValue({
      id: "oauth-history",
      clientId: "mcp",
      userId: null,
      redirectUri: process.env.MCP_GITHUB_REDIRECT_URI,
      oauthClientId: client.client_id,
      oauthRedirectUri: "http://127.0.0.1:43123/callback",
      oauthState: "client-state-123",
      codeChallenge: "A".repeat(43),
      audience: "https://mcp.example.com",
      scope: "resume:use",
      stateConsumedAt: null,
      stateExpiresAt: new Date(Date.now() + 60_000),
      status: "pending",
    });
    prisma.authHistory.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
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

    const result = await service.completeMcpOAuthCallback(
      "github-code",
      githubState,
    );

    expect(result).toMatchObject({
      redirectUri: "http://127.0.0.1:43123/callback",
      clientState: "client-state-123",
      code: githubState,
      issuer: "https://api.example.com/auth",
    });
    expect(prisma.authHistory.findUnique).toHaveBeenCalledWith({
      where: {
        stateHash: createHash("sha256").update(githubState).digest("hex"),
      },
    });
    expect(prisma.authHistory.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "oauth-history", userId: null }),
        data: expect.objectContaining({ userId: 42 }),
      }),
    );
  });

  it("허용되지 않은 GitHub 사용자는 OAuth client에 access_denied로 돌아간다", async () => {
    const client = service.registerOAuthClient({
      redirect_uris: ["http://127.0.0.1:43123/callback"],
    });
    const authorization = await service.startMcpOAuthAuthorization({
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:43123/callback",
      state: "client-state-123",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
      resource: "https://mcp.example.com",
      scope: "resume:use",
    });
    const githubState = new URL(
      authorization.authorizationUrl,
    ).searchParams.get("state");
    if (!githubState) throw new Error("GitHub OAuth state missing");
    prisma.authHistory.findUnique.mockResolvedValue({
      id: "oauth-history",
      clientId: "mcp",
      userId: null,
      redirectUri: process.env.MCP_GITHUB_REDIRECT_URI,
      oauthClientId: client.client_id,
      oauthRedirectUri: "http://127.0.0.1:43123/callback",
      oauthState: "client-state-123",
      codeChallenge: "A".repeat(43),
      audience: "https://mcp.example.com",
      scope: "resume:use",
      stateConsumedAt: null,
      stateExpiresAt: new Date(Date.now() + 60_000),
      status: "pending",
    });
    prisma.authHistory.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "github-access" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 999, name: "Unlisted user" }),
      }) as unknown as typeof fetch;

    const result = await service.completeMcpOAuthCallback(
      "github-code",
      githubState,
    );

    expect(result).toMatchObject({
      redirectUri: "http://127.0.0.1:43123/callback",
      clientState: "client-state-123",
      error: "access_denied",
      issuer: "https://api.example.com/auth",
    });
    expect(userIdentity.resolveGitHubUser).not.toHaveBeenCalled();
  });

  it("유효한 OAuth code와 PKCE verifier로 portfolio-api 토큰을 발급한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    process.env.AUTH_PRIVATE_KEY = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    const client = service.registerOAuthClient({
      redirect_uris: ["http://127.0.0.1:43123/callback"],
      grant_types: ["authorization_code", "refresh_token"],
    });
    const verifier = "v".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    prisma.authHistory.findUnique.mockResolvedValue({
      id: "oauth-history",
      clientId: "mcp",
      userId: 42,
      oauthClientId: client.client_id,
      oauthRedirectUri: "http://127.0.0.1:43123/callback",
      codeChallenge: challenge,
      stateConsumedAt: new Date(),
      stateExpiresAt: new Date(Date.now() + 60_000),
      audience: "https://mcp.example.com",
      scope: "resume:use",
      revokedAt: null,
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.authHistory.updateMany.mockResolvedValue({ count: 1 });
    prisma.userToken.create.mockResolvedValue({ id: "refresh-row" });

    const tokens = await service.exchangeMcpOAuthAuthorizationCode({
      code: "oauth-code",
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:43123/callback",
      code_verifier: verifier,
      resource: "https://mcp.example.com",
    });

    const claims = verify(
      tokens.access_token,
      keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      {
        algorithms: ["RS256"],
        issuer: process.env.AUTH_ISSUER,
        audience: process.env.MCP_RESOURCE_URL,
      },
    ) as { scope: string; sub: string };
    if (!tokens.refresh_token) throw new Error("refresh token missing");
    expect(claims).toMatchObject({ sub: "42", scope: "resume:use" });
    expect(tokens).toMatchObject({
      token_type: "Bearer",
      expires_in: 3600,
      scope: "resume:use",
      refresh_token: expect.any(String),
    });
    expect(prisma.userToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authHistoryId: "oauth-history",
          tokenHash: expect.not.stringContaining(tokens.refresh_token),
        }),
      }),
    );
  });

  it("유효한 MCP access token과 활성 세션만 introspection에서 active로 반환한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKey = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.AUTH_PRIVATE_KEY = privateKey;
    const token = signJwt(
      { scope: "resume:use", sid: "mcp-session" },
      privateKey,
      {
        algorithm: "RS256",
        subject: "42",
        audience: "https://mcp.example.com",
        issuer: "https://api.example.com/auth",
        expiresIn: 3600,
      },
    );
    prisma.authHistory.findUnique.mockResolvedValue({
      id: "mcp-session",
      clientId: "mcp",
      userId: 42,
      audience: "https://mcp.example.com",
      scope: "resume:use",
      status: "authenticated",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.introspectMcpAccessToken(token);

    expect(result).toMatchObject({
      active: true,
      client_id: "mcp",
      sub: "42",
      aud: "https://mcp.example.com",
      iss: "https://api.example.com/auth",
      scope: "resume:use",
    });
    expect(prisma.authHistory.findUnique).toHaveBeenCalledWith({
      where: { id: "mcp-session" },
    });
  });

  it("폐기된 MCP 세션의 유효한 JWT는 introspection에서 inactive로 반환한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKey = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.AUTH_PRIVATE_KEY = privateKey;
    const token = signJwt(
      { scope: "resume:use", sid: "revoked-session" },
      privateKey,
      {
        algorithm: "RS256",
        subject: "42",
        audience: "https://mcp.example.com",
        issuer: "https://api.example.com/auth",
        expiresIn: 3600,
      },
    );
    prisma.authHistory.findUnique.mockResolvedValue({
      id: "revoked-session",
      clientId: "mcp",
      userId: 42,
      audience: "https://mcp.example.com",
      scope: "resume:use",
      status: "revoked",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.introspectMcpAccessToken(token)).resolves.toEqual({
      active: false,
    });
  });

  it("잘못된 audience의 JWT는 DB 조회 없이 introspection에서 inactive로 반환한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKey = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.AUTH_PRIVATE_KEY = privateKey;
    const token = signJwt(
      { scope: "resume:use", sid: "wrong-audience-session" },
      privateKey,
      {
        algorithm: "RS256",
        subject: "42",
        audience: "https://other.example.com",
        issuer: "https://api.example.com/auth",
        expiresIn: 3600,
      },
    );

    await expect(service.introspectMcpAccessToken(token)).resolves.toEqual({
      active: false,
    });
    expect(prisma.authHistory.findUnique).not.toHaveBeenCalled();
  });

  it("활성 표시가 남아 있어도 만료된 AuthHistory 세션은 inactive로 반환한다", async () => {
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privateKey = keys.privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    process.env.AUTH_PRIVATE_KEY = privateKey;
    const token = signJwt(
      { scope: "resume:use", sid: "expired-session" },
      privateKey,
      {
        algorithm: "RS256",
        subject: "42",
        audience: "https://mcp.example.com",
        issuer: "https://api.example.com/auth",
        expiresIn: 3600,
      },
    );
    prisma.authHistory.findUnique.mockResolvedValue({
      id: "expired-session",
      clientId: "mcp",
      userId: 42,
      audience: "https://mcp.example.com",
      scope: "resume:use",
      status: "authenticated",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1),
    });

    await expect(service.introspectMcpAccessToken(token)).resolves.toEqual({
      active: false,
    });
  });

  it("PKCE verifier가 다르면 OAuth authorization code를 소비하지 않는다", async () => {
    const client = service.registerOAuthClient({
      redirect_uris: ["http://127.0.0.1:43123/callback"],
      grant_types: ["authorization_code", "refresh_token"],
    });
    prisma.authHistory.findUnique.mockResolvedValue({
      id: "oauth-history",
      clientId: "mcp",
      userId: 42,
      oauthClientId: client.client_id,
      oauthRedirectUri: "http://127.0.0.1:43123/callback",
      codeChallenge: createHash("sha256")
        .update("e".repeat(43))
        .digest("base64url"),
      stateConsumedAt: new Date(),
      stateExpiresAt: new Date(Date.now() + 60_000),
      audience: "https://mcp.example.com",
      scope: "resume:use",
      revokedAt: null,
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.exchangeMcpOAuthAuthorizationCode({
        code: "oauth-code",
        client_id: client.client_id,
        redirect_uri: "http://127.0.0.1:43123/callback",
        code_verifier: "w".repeat(43),
        resource: "https://mcp.example.com",
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.authHistory.updateMany).not.toHaveBeenCalled();
    expect(prisma.userToken.create).not.toHaveBeenCalled();
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

describe("공통 서비스 OAuth", () => {
  const env = { ...process.env };
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const prisma = { authHistory: { create: jest.fn(), findUnique: jest.fn() } };
  let service: AuthService;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SERVICE_OAUTH_CLIENT_ID = "project-service";
    process.env.SERVICE_OAUTH_CLIENT_SECRET = "fixture-secret";
    process.env.SERVICE_OAUTH_AUDIENCE =
      "https://api.example.com/service/project";
    process.env.AUTH_ISSUER = "https://api.example.com/auth";
    process.env.AUTH_PRIVATE_KEY = keys.privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    prisma.authHistory.create.mockResolvedValue({ id: "service-history" });
    service = new AuthService(prisma as never, {} as never, {} as never);
  });
  afterEach(() => {
    process.env = { ...env };
  });
  it("유효한 서비스 JWT라도 활성 서비스 인증 이력과 일치할 때만 프로젝트 쓰기를 허용한다", async () => {
    const response = await service.issueServiceAccessToken(
      "project-service",
      "fixture-secret",
    );
    const active = {
      clientId: "service",
      oauthClientId: "project-service",
      userId: null,
      audience: process.env.SERVICE_OAUTH_AUDIENCE,
      scope: "project:write",
      status: "authenticated",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 900000),
    };
    prisma.authHistory.findUnique.mockResolvedValue(active);
    await expect(
      service.validateProjectServiceToken(response.access_token),
    ).resolves.toBeUndefined();
    prisma.authHistory.findUnique.mockResolvedValue({
      ...active,
      revokedAt: new Date(),
    });
    await expect(
      service.validateProjectServiceToken(response.access_token),
    ).rejects.toThrow(UnauthorizedException);
  });
  it("공통 client 자격으로 사용자 없이 15분 JWT와 인증 이력을 만들고 refresh token은 발급하지 않는다", async () => {
    const response = await service.issueServiceAccessToken(
      "project-service",
      "fixture-secret",
      "project:write",
    );
    expect(response).toMatchObject({
      token_type: "Bearer",
      expires_in: 900,
      scope: "project:write",
    });
    expect(response).not.toHaveProperty("refresh_token");
    expect(
      verify(response.access_token, keys.publicKey, {
        algorithms: ["RS256"],
        issuer: process.env.AUTH_ISSUER,
        audience: process.env.SERVICE_OAUTH_AUDIENCE,
      }),
    ).toMatchObject({
      sub: "project-service",
      client_id: "project-service",
      scope: "project:write",
      sid: "service-history",
    });
    expect(prisma.authHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: "service",
        oauthClientId: "project-service",
        userId: null,
        status: "authenticated",
        scope: "project:write",
      }),
    });
  });
  it("잘못된 client 자격과 scope는 인증 이력을 만들기 전에 거부한다", async () => {
    await expect(
      service.issueServiceAccessToken("wrong", "fixture-secret"),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.issueServiceAccessToken("project-service", "wrong"),
    ).rejects.toThrow(UnauthorizedException);
    delete process.env.SERVICE_OAUTH_CLIENT_SECRET;
    await expect(
      service.issueServiceAccessToken("project-service", "fixture-secret"),
    ).rejects.toThrow(UnauthorizedException);
    process.env.SERVICE_OAUTH_CLIENT_SECRET = "fixture-secret";
    await expect(
      service.issueServiceAccessToken(
        "project-service",
        "fixture-secret",
        "resume:use",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.authHistory.create).not.toHaveBeenCalled();
  });
  it("잘못된 issuer·audience·scope·사용자·만료 토큰은 서비스 세션 조회 없이 거부한다", async () => {
    const claims = {
      scope: "project:write",
      client_id: "project-service",
      sid: "service-history",
    };
    const options = {
      algorithm: "RS256" as const,
      issuer: process.env.AUTH_ISSUER,
      audience: process.env.SERVICE_OAUTH_AUDIENCE,
      subject: "project-service",
      expiresIn: 900,
    };
    for (const token of [
      "broken-jwt",
      signJwt({ ...claims, scope: "resume:use" }, keys.privateKey, options),
      signJwt(claims, keys.privateKey, {
        ...options,
        issuer: "https://wrong.example",
      }),
      signJwt(claims, keys.privateKey, {
        ...options,
        audience: "https://wrong.example",
      }),
      signJwt(claims, keys.privateKey, { ...options, subject: "123" }),
      signJwt(claims, keys.privateKey, { ...options, expiresIn: -1 }),
    ])
      await expect(service.validateProjectServiceToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    expect(prisma.authHistory.findUnique).not.toHaveBeenCalled();
  });
  it("서비스 인증 이력 조회와 발급의 원문 DB 오류를 노출하지 않는다", async () => {
    const response = await service.issueServiceAccessToken(
      "project-service",
      "fixture-secret",
    );
    prisma.authHistory.findUnique.mockRejectedValue(
      new Error("private-db-fixture"),
    );
    await expect(
      service.validateProjectServiceToken(response.access_token),
    ).rejects.toMatchObject({
      message: "서비스 인증 상태를 확인할 수 없습니다.",
    });
    prisma.authHistory.create.mockRejectedValueOnce(
      new Error("private-db-fixture"),
    );
    await expect(
      service.issueServiceAccessToken("project-service", "fixture-secret"),
    ).rejects.toMatchObject({ message: "서비스 토큰을 발급할 수 없습니다." });
  });
});
