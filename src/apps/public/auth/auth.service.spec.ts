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
      { verify: jest.fn() } as never,
    );
  });

  it("고정 서비스 토큰은 MCP에만 허용하고 남아 있는 portfolio 설정은 사용하지 않는다", () => {
    expect(() =>
      service.validateServiceToken("mcp", "mcp-service-secret"),
    ).not.toThrow();
    expect(() =>
      service.validateServiceToken("portfolio", "portfolio-service-secret"),
    ).toThrow(UnauthorizedException);
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
      scopes_supported: ["resume:use", "project:write", "auth:manage"],
      grant_types_supported: [
        "authorization_code",
        "refresh_token",
        "urn:ietf:params:oauth:grant-type:token-exchange",
      ],
      token_endpoint_auth_methods_supported: ["none"],
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

describe("GitHub Actions OAuth", () => {
  const env = { ...process.env };
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const prisma = {
    authHistory: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const oidc = { verify: jest.fn() };
  let service: AuthService;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AUTH_ISSUER = "https://api.example.com/auth";
    delete process.env.SERVICE_OAUTH_CLIENT_ID;
    delete process.env.SERVICE_OAUTH_CLIENT_SECRET;
    delete process.env.SERVICE_OAUTH_AUDIENCE;
    process.env.AUTH_PRIVATE_KEY = keys.privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    prisma.authHistory.create.mockResolvedValue({ id: "service-history" });
    prisma.authHistory.updateMany.mockResolvedValue({ count: 1 });
    oidc.verify.mockResolvedValue(undefined);
    service = new AuthService(
      prisma as never,
      {} as never,
      {} as never,
      oidc as never,
    );
  });
  afterEach(() => {
    process.env = { ...env };
  });
  it("고정 client 자격 없이 GitHub OIDC를 검증해 15분 프로젝트 토큰을 발급한다", async () => {
    const response = await service.issueServiceAccessToken(
      "github-oidc",
      "project:write",
    );
    expect(oidc.verify).toHaveBeenCalledWith(
      "github-oidc",
      "https://api.example.com",
    );
    expect(response).toMatchObject({
      token_type: "Bearer",
      expires_in: 900,
      scope: "project:write",
      issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
    });
    expect(response).not.toHaveProperty("refresh_token");
    expect(
      verify(response.access_token, keys.publicKey, {
        algorithms: ["RS256"],
        issuer: process.env.AUTH_ISSUER,
        audience: "https://api.example.com",
      }),
    ).toMatchObject({
      sub: "github-actions:91575756",
      scope: "project:write",
      sid: "service-history",
    });
  });
  it("발급한 토큰은 활성 세션일 때만 허용하고 종료 시 해당 세션만 폐기한다", async () => {
    const response = await service.issueServiceAccessToken("github-oidc");
    const history = {
      clientId: "service",
      oauthClientId: "github-actions:91575756",
      userId: null,
      audience: "https://api.example.com",
      scope: "project:write",
      status: "authenticated",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 900000),
    };
    prisma.authHistory.findUnique.mockResolvedValue(history);
    await expect(
      service.validateProjectServiceToken(response.access_token),
    ).resolves.toBeUndefined();
    await expect(
      service.revokeServiceAccessToken(response.access_token),
    ).resolves.toBeUndefined();
    expect(prisma.authHistory.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "service-history",
        clientId: "service",
        oauthClientId: "github-actions:91575756",
      }),
      data: expect.objectContaining({
        status: "revoked",
        revokedAt: expect.any(Date),
      }),
    });
    prisma.authHistory.findUnique.mockResolvedValue({
      ...history,
      revokedAt: new Date(),
    });
    await expect(
      service.validateProjectServiceToken(response.access_token),
    ).rejects.toThrow(UnauthorizedException);
  });
  it("OIDC 거부와 허용하지 않은 scope는 세션을 만들기 전에 거부한다", async () => {
    oidc.verify.mockRejectedValueOnce(new UnauthorizedException());
    await expect(service.issueServiceAccessToken("untrusted")).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      service.issueServiceAccessToken("github-oidc", "resume:use"),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.authHistory.create).not.toHaveBeenCalled();
  });
  it("프로젝트 쓰기와 인증 관리 scope는 교차 사용할 수 없다", async () => {
    const project = await service.issueServiceAccessToken(
      "github-oidc",
      "project:write",
    );
    const auth = await service.issueServiceAccessToken(
      "github-oidc",
      "auth:manage",
    );
    await expect(
      service.validateOAuthServiceToken(project.access_token, "auth:manage"),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.validateProjectServiceToken(auth.access_token),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.authHistory.findUnique).not.toHaveBeenCalled();
  });
  it("잘못된 API 서명·issuer·audience·scope·만료·주체는 DB 조회 전에 거부한다", async () => {
    const claims = {
      scope: "project:write",
      client_id: "github-actions:91575756",
      sid: "service-history",
    };
    const opts = {
      algorithm: "RS256" as const,
      issuer: process.env.AUTH_ISSUER,
      audience: "https://api.example.com",
      subject: "github-actions:91575756",
      expiresIn: 900,
    };
    for (const token of [
      "broken",
      signJwt(claims, keys.privateKey, {
        ...opts,
        issuer: "https://wrong.invalid",
      }),
      signJwt(claims, keys.privateKey, {
        ...opts,
        audience: "https://wrong.invalid",
      }),
      signJwt(claims, keys.privateKey, { ...opts, expiresIn: -1 }),
      signJwt(claims, keys.privateKey, { ...opts, subject: "123" }),
      signJwt({ ...claims, scope: "resume:use" }, keys.privateKey, opts),
    ])
      await expect(service.validateProjectServiceToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    expect(prisma.authHistory.findUnique).not.toHaveBeenCalled();
  });
  it("서명된 토큰도 다른 사용자·client·scope·만료·폐기 세션에 연결되면 거부한다", async () => {
    const response = await service.issueServiceAccessToken("github-oidc");
    const history = {
      clientId: "service",
      oauthClientId: "github-actions:91575756",
      userId: null,
      audience: "https://api.example.com",
      scope: "project:write",
      status: "authenticated",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 900000),
    };
    for (const invalid of [
      null,
      { ...history, clientId: "mcp" },
      { ...history, oauthClientId: "other" },
      { ...history, userId: 42 },
      { ...history, audience: "other" },
      { ...history, scope: "auth:manage" },
      { ...history, status: "revoked" },
      { ...history, revokedAt: new Date() },
      { ...history, expiresAt: new Date(0) },
    ]) {
      prisma.authHistory.findUnique.mockResolvedValue(invalid);
      await expect(
        service.validateProjectServiceToken(response.access_token),
      ).rejects.toThrow(UnauthorizedException);
    }
  });
  it("발급·검증·폐기 시 DB 오류 원문은 응답에 노출하지 않는다", async () => {
    const response = await service.issueServiceAccessToken("github-oidc");
    prisma.authHistory.findUnique.mockRejectedValue(
      new Error("private-db-error"),
    );
    await expect(
      service.validateProjectServiceToken(response.access_token),
    ).rejects.toMatchObject({
      status: 503,
      message: "서비스 인증 상태를 확인할 수 없습니다.",
    });
    prisma.authHistory.updateMany.mockRejectedValue(
      new Error("private-db-error"),
    );
    await expect(
      service.revokeServiceAccessToken(response.access_token),
    ).rejects.toMatchObject({
      status: 503,
      message: "서비스 인증 상태를 갱신할 수 없습니다.",
    });
    prisma.authHistory.create.mockRejectedValue(new Error("private-db-error"));
    await expect(
      service.issueServiceAccessToken("github-oidc"),
    ).rejects.toMatchObject({
      status: 503,
      message: "서비스 토큰을 발급할 수 없습니다.",
    });
  });
});
