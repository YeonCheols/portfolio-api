import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthServiceTokenGuard } from "./auth-service-token.guard";
import { AuthService } from "./auth.service";

type AuthClientId = "portfolio" | "mcp";
type ClientRequest = { client_id?: AuthClientId };

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get(".well-known/jwks.json")
  @ApiOperation({ summary: "공용 access token 서명 공개키 조회" })
  getJwks() {
    return this.service.getJwks();
  }

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "공개 OAuth client 동적 등록" })
  register(@Body() body?: unknown) {
    return this.service.registerOAuthClient(body);
  }

  @Get("authorize")
  @Redirect()
  @ApiOperation({ summary: "OAuth authorization code 흐름 시작" })
  async oauthAuthorize(@Query() query: Record<string, string>) {
    const { authorizationUrl } = await this.service.startMcpOAuthAuthorization({
      client_id: query.client_id ?? "",
      redirect_uri: query.redirect_uri ?? "",
      state: query.state ?? "",
      code_challenge: query.code_challenge ?? "",
      code_challenge_method: query.code_challenge_method ?? "",
      resource: query.resource ?? "",
      scope: query.scope ?? "",
    });
    return { url: authorizationUrl, statusCode: 302 };
  }

  @Get("github/callback")
  @Redirect()
  @ApiOperation({ summary: "GitHub 인증 결과를 MCP OAuth client로 전달" })
  async oauthCallback(@Query() query: Record<string, string>) {
    if (!query.state)
      throw new BadRequestException("invalid_authorization_state");
    const result = await this.service.completeMcpOAuthCallback(
      query.code ?? "",
      query.state,
    );
    const redirect = new URL(result.redirectUri);
    if (result.code) redirect.searchParams.set("code", result.code);
    if (result.error) redirect.searchParams.set("error", result.error);
    redirect.searchParams.set("state", result.clientState);
    redirect.searchParams.set("iss", result.issuer);
    return { url: redirect.toString(), statusCode: 302 };
  }

  @Post("token")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @ApiOperation({
    summary: "OAuth 사용자 토큰 교환 또는 공통 서비스 토큰 발급",
  })
  async oauthToken(
    @Body() input?: unknown,
    @Headers("authorization") authorization?: string,
  ) {
    const body = this.requireOAuthBody(input);
    const grantType = body.grant_type;
    if (grantType === "urn:ietf:params:oauth:grant-type:token-exchange") {
      if (
        authorization !== undefined ||
        body.client_id !== undefined ||
        body.client_secret !== undefined ||
        body.subject_token_type !== "urn:ietf:params:oauth:token-type:jwt" ||
        (body.scope !== undefined && typeof body.scope !== "string")
      )
        throw new BadRequestException({ error: "invalid_request" });
      return this.service.issueServiceAccessToken(
        this.requireOAuthString(body, "subject_token"),
        body.scope,
      );
    }
    if (grantType === "authorization_code") {
      try {
        return await this.service.exchangeMcpOAuthAuthorizationCode({
          code: this.requireOAuthString(body, "code"),
          client_id: this.requireOAuthString(body, "client_id"),
          redirect_uri: this.requireOAuthString(body, "redirect_uri"),
          code_verifier: this.requireOAuthString(body, "code_verifier"),
          resource: this.requireOAuthString(body, "resource"),
        });
      } catch (error) {
        this.rethrowOAuthTokenError(error);
      }
    }
    if (grantType === "refresh_token") {
      try {
        return await this.service.refreshOAuthToken(
          this.requireOAuthString(body, "client_id"),
          this.requireOAuthString(body, "refresh_token"),
        );
      } catch (error) {
        this.rethrowOAuthTokenError(error);
      }
    }
    throw new BadRequestException({ error: "unsupported_grant_type" });
  }

  @Post("oauth/revoke")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @ApiOperation({ summary: "OAuth access token 또는 refresh token 폐기" })
  async oauthRevoke(@Body() input?: unknown) {
    const body = this.requireOAuthBody(input);
    try {
      if (body.token_type_hint === "access_token") {
        await this.service.revokeServiceAccessToken(
          this.requireOAuthString(body, "token"),
        );
        return {};
      }
      return await this.service.revokeOAuthToken(
        this.requireOAuthString(body, "client_id"),
        this.requireOAuthString(body, "token"),
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException({ error: "invalid_client" });
      }
      throw error;
    }
  }

  @Post("introspect")
  @HttpCode(HttpStatus.OK)
  @Header("Cache-Control", "no-store")
  @Header("Pragma", "no-cache")
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "MCP access token의 현재 유효성 조회" })
  introspect(@Body() body?: ClientRequest & { token?: string }) {
    if (body?.client_id !== "mcp") {
      throw new BadRequestException({ error: "invalid_request" });
    }
    if (!body.token) {
      throw new BadRequestException({ error: "invalid_request" });
    }
    return this.service.introspectMcpAccessToken(body.token);
  }

  @Post("authorize")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "앱별 GitHub OAuth 시작 URL 및 일회용 state 생성" })
  authorize(@Body() body?: ClientRequest) {
    const clientId = this.requireClientId(body?.client_id);
    return this.service.createOAuthState(clientId);
  }

  @Post("callback")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "GitHub OAuth 증명 확인 후 공용 사용자 토큰 발급" })
  callback(@Body() body?: ClientRequest & { code?: string; state?: string }) {
    const clientId = this.requireClientId(body?.client_id);
    if (!body?.code || !body.state)
      throw new BadRequestException("code와 state가 필요합니다.");
    return this.service.exchangeGitHubCode(clientId, body.code, body.state);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "앱별 refresh token 회전" })
  refresh(@Body() body?: ClientRequest & { refresh_token?: string }) {
    const clientId = this.requireClientId(body?.client_id);
    if (!body?.refresh_token)
      throw new BadRequestException("refresh_token이 필요합니다.");
    return this.service.refresh(clientId, body.refresh_token);
  }

  @Post("revoke")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthServiceTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "앱별 토큰 세션 폐기" })
  async revoke(@Body() body?: ClientRequest & { refresh_token?: string }) {
    const clientId = this.requireClientId(body?.client_id);
    if (!body?.refresh_token)
      throw new BadRequestException("refresh_token이 필요합니다.");
    await this.service.revoke(clientId, body.refresh_token);
    return { revoked: true };
  }

  private requireClientId(clientId?: string): AuthClientId {
    if (clientId !== "portfolio" && clientId !== "mcp") {
      throw new BadRequestException(
        "client_id는 portfolio 또는 mcp여야 합니다.",
      );
    }
    return clientId;
  }

  private requireOAuthBody(input?: unknown): Record<string, unknown> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException({ error: "invalid_request" });
    }
    return input as Record<string, unknown>;
  }

  private requireOAuthString(
    body: Record<string, unknown>,
    key: string,
  ): string {
    const value = body[key];
    if (typeof value !== "string" || !value) {
      throw new BadRequestException({ error: "invalid_request" });
    }
    return value;
  }

  private rethrowOAuthTokenError(error: unknown): never {
    if (!(error instanceof UnauthorizedException)) throw error;
    const response = error.getResponse();
    if (
      typeof response === "object" &&
      response !== null &&
      "error" in response &&
      response.error === "invalid_client"
    ) {
      throw new UnauthorizedException({ error: "invalid_client" });
    }
    throw new BadRequestException({ error: "invalid_grant" });
  }
}
