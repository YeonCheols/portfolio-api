import {
  BadRequestException,
  RequestMethod,
  UnauthorizedException,
} from "@nestjs/common";
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import { AuthServiceTokenGuard } from "./auth-service-token.guard";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  const service = {
    getJwks: jest.fn(),
    issueServiceAccessToken: jest.fn(),
    revokeServiceAccessToken: jest.fn(),
    registerOAuthClient: jest.fn(),
    startMcpOAuthAuthorization: jest.fn(),
    completeMcpOAuthCallback: jest.fn(),
    exchangeMcpOAuthAuthorizationCode: jest.fn(),
    refreshOAuthToken: jest.fn(),
    revokeOAuthToken: jest.fn(),
    introspectMcpAccessToken: jest.fn(),
    createOAuthState: jest.fn(),
    exchangeGitHubCode: jest.fn(),
    refresh: jest.fn(),
    revoke: jest.fn(),
  };
  let controller: AuthController;
  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(service as never);
  });

  it("GitHub OIDC token exchange 요청을 전달하고 client_credentials는 지원하지 않는다", async () => {
    service.issueServiceAccessToken.mockResolvedValue({
      access_token: "workflow-access",
    });
    await expect(
      controller.oauthToken({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        subject_token: "github-oidc",
        scope: "project:write",
      }),
    ).resolves.toEqual({ access_token: "workflow-access" });
    expect(service.issueServiceAccessToken).toHaveBeenCalledWith(
      "github-oidc",
      "project:write",
    );
    await expect(
      controller.oauthToken({
        grant_type: "client_credentials",
        client_id: "obsolete",
        client_secret: "obsolete",
      }),
    ).rejects.toMatchObject({ response: { error: "unsupported_grant_type" } });
  });

  it("OIDC 교환에 중복 자격·누락 토큰·다른 token type·비문자 scope를 허용하지 않는다", async () => {
    const body = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: "github-oidc",
    };
    for (const invalid of [
      { ...body, client_id: "obsolete" },
      { ...body, client_secret: "obsolete" },
      { ...body, subject_token_type: "invalid" },
      { ...body, subject_token: "" },
      { ...body, scope: ["project:write"] },
    ])
      await expect(controller.oauthToken(invalid)).rejects.toMatchObject({
        status: 400,
      });
    await expect(
      controller.oauthToken(body, "Basic obsolete"),
    ).rejects.toMatchObject({ status: 400 });
    expect(service.issueServiceAccessToken).not.toHaveBeenCalled();
  });

  it("access token 폐기는 public MCP refresh token 폐기와 분리해 처리한다", async () => {
    service.revokeServiceAccessToken.mockResolvedValue(undefined);
    await expect(
      controller.oauthRevoke({
        token: "workflow-access",
        token_type_hint: "access_token",
      }),
    ).resolves.toEqual({});
    expect(service.revokeServiceAccessToken).toHaveBeenCalledWith(
      "workflow-access",
    );
    expect(service.revokeOAuthToken).not.toHaveBeenCalled();
  });

  it("공개 OAuth client 등록을 서비스에 전달한다", () => {
    const request = { redirect_uris: ["https://client.example/callback"] };
    service.registerOAuthClient.mockReturnValue({ client_id: "signed-id" });

    const response = controller.register(request);

    expect(response).toEqual({ client_id: "signed-id" });
    expect(service.registerOAuthClient).toHaveBeenCalledWith(request);
  });

  it("OAuth authorize 요청을 MCP 로그인 흐름으로 전달한다", async () => {
    const request = {
      client_id: "signed-id",
      redirect_uri: "http://127.0.0.1:43123/callback",
      state: "client-state-123",
      code_challenge: "A".repeat(43),
      code_challenge_method: "S256",
      resource: "https://mcp.example.com",
      scope: "resume:use",
    };
    service.startMcpOAuthAuthorization.mockResolvedValue({
      authorizationUrl: "https://github.com/login/oauth/authorize?state=api",
    });

    const response = await controller.oauthAuthorize(request);

    expect(response).toEqual({
      url: "https://github.com/login/oauth/authorize?state=api",
      statusCode: 302,
    });
    expect(service.startMcpOAuthAuthorization).toHaveBeenCalledWith(request);
  });

  it("GitHub OAuth callback을 검증한 뒤 MCP client로 redirect한다", async () => {
    service.completeMcpOAuthCallback.mockResolvedValue({
      redirectUri: "http://127.0.0.1:43123/callback",
      clientState: "client-state-123",
      code: "authorization-code",
      issuer: "https://api.example.com/auth",
    });

    const response = await controller.oauthCallback({
      code: "github-code",
      state: "oauth-state",
    });

    const redirect = new URL(response.url);
    expect(response.statusCode).toBe(302);
    expect(redirect.origin).toBe("http://127.0.0.1:43123");
    expect(redirect.searchParams.get("code")).toBe("authorization-code");
    expect(redirect.searchParams.get("state")).toBe("client-state-123");
    expect(redirect.searchParams.get("iss")).toBe(
      "https://api.example.com/auth",
    );
    expect(service.completeMcpOAuthCallback).toHaveBeenCalledWith(
      "github-code",
      "oauth-state",
    );
  });

  it("authorization_code token 요청을 API 토큰 발급 서비스로 전달한다", async () => {
    const request = {
      grant_type: "authorization_code",
      code: "oauth-code",
      client_id: "signed-id",
      redirect_uri: "http://127.0.0.1:43123/callback",
      code_verifier: "v".repeat(43),
      resource: "https://mcp.example.com",
    };
    const tokens = { access_token: "api-token", token_type: "Bearer" };
    service.exchangeMcpOAuthAuthorizationCode.mockResolvedValue(tokens);

    const response = await controller.oauthToken(request);

    expect(response).toEqual(tokens);
    expect(service.exchangeMcpOAuthAuthorizationCode).toHaveBeenCalledWith({
      code: "oauth-code",
      client_id: "signed-id",
      redirect_uri: "http://127.0.0.1:43123/callback",
      code_verifier: "v".repeat(43),
      resource: "https://mcp.example.com",
    });
  });

  it("refresh_token grant를 token 회전 서비스로 전달한다", async () => {
    const tokens = { access_token: "rotated-api-token", token_type: "Bearer" };
    service.refreshOAuthToken.mockReturnValue(tokens);

    const response = await controller.oauthToken({
      grant_type: "refresh_token",
      client_id: "signed-id",
      refresh_token: "opaque-refresh-token",
    });

    expect(response).toEqual(tokens);
    expect(service.refreshOAuthToken).toHaveBeenCalledWith(
      "signed-id",
      "opaque-refresh-token",
    );
  });

  it("만료되거나 잘못된 OAuth token grant를 invalid_grant 응답으로 반환한다", async () => {
    service.exchangeMcpOAuthAuthorizationCode.mockRejectedValue(
      new UnauthorizedException(),
    );

    await expect(
      controller.oauthToken({
        grant_type: "authorization_code",
        code: "invalid-code",
        client_id: "signed-id",
        redirect_uri: "http://127.0.0.1:43123/callback",
        code_verifier: "v".repeat(43),
        resource: "https://mcp.example.com",
      }),
    ).rejects.toMatchObject({
      response: { error: "invalid_grant" },
      status: 400,
    });
  });

  it("알 수 없는 public client는 OAuth invalid_client 응답을 반환한다", async () => {
    service.exchangeMcpOAuthAuthorizationCode.mockRejectedValue(
      new UnauthorizedException({ error: "invalid_client" }),
    );

    await expect(
      controller.oauthToken({
        grant_type: "authorization_code",
        code: "oauth-code",
        client_id: "unknown-client",
        redirect_uri: "http://127.0.0.1:43123/callback",
        code_verifier: "v".repeat(43),
        resource: "https://mcp.example.com",
      }),
    ).rejects.toMatchObject({
      response: { error: "invalid_client" },
      status: 401,
    });
  });

  it("OAuth revocation 요청을 토큰 폐기 서비스로 전달한다", async () => {
    service.revokeOAuthToken.mockReturnValue({});

    const response = await controller.oauthRevoke({
      client_id: "signed-id",
      token: "opaque-refresh-token",
      token_type_hint: "refresh_token",
    });

    expect(response).toEqual({});
    expect(service.revokeOAuthToken).toHaveBeenCalledWith(
      "signed-id",
      "opaque-refresh-token",
    );
  });

  it("MCP access token introspection 요청을 서비스에 전달한다", async () => {
    const result = { active: true, sub: "42", scope: "resume:use" };
    service.introspectMcpAccessToken.mockResolvedValue(result);

    const response = await controller.introspect({
      client_id: "mcp",
      token: "api-access-token",
    });

    expect(response).toEqual(result);
    expect(service.introspectMcpAccessToken).toHaveBeenCalledWith(
      "api-access-token",
    );
  });

  it("introspection route는 POST이며 서비스 토큰 guard로 보호한다", () => {
    const handler = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      "introspect",
    )?.value as object;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe("introspect");
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(
      AuthServiceTokenGuard,
    );
  });

  it("지원하지 않는 client_id를 거부한다", () => {
    expect(() =>
      controller.authorize({ client_id: "unknown" as never }),
    ).toThrow(BadRequestException);
    expect(service.createOAuthState).not.toHaveBeenCalled();
  });
  it("code/state가 없는 callback을 거부한다", () => {
    expect(() =>
      controller.callback({ client_id: "mcp", code: "code" }),
    ).toThrow(BadRequestException);
    expect(() => controller.callback(undefined as never)).toThrow(
      BadRequestException,
    );
    expect(service.exchangeGitHubCode).not.toHaveBeenCalled();
  });
  it("refresh token이 없는 요청을 거부한다", () => {
    expect(() => controller.refresh({ client_id: "mcp" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.refresh(undefined as never)).toThrow(
      BadRequestException,
    );
    expect(service.refresh).not.toHaveBeenCalled();
  });
});
