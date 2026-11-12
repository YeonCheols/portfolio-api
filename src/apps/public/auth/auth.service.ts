import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { sign, verify as verifyJwt, type JwtPayload } from "jsonwebtoken";
import { AuthHistoryStatus } from "@prisma/client";
import { OAuthStateService } from "src/apps/identity/oauth-state.service";
import { UserIdentityService } from "src/apps/identity/user-identity.service";
import { PrismaService } from "src/prisma/prisma.service";

type AuthClientId = "portfolio" | "mcp";
type ClientConfig = {
  githubClientId: string;
  githubClientSecret: string;
  redirectUri: string;
  audience: string;
  scope: string;
  allowedGithubUserIds: string[];
};
type OAuthClient = {
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  client_name?: string;
};
type OAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_at?: string;
  scope: string;
};

const isValidRedirectUri = (value: string): boolean => {
  try {
    const url = new URL(value);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    );
    return (
      (url.protocol === "https:" || (url.protocol === "http:" && isLoopback)) &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
};

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value?.trim())
    throw new Error(`${name} 환경 변수가 설정되지 않았습니다.`);
  return value;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userIdentity: UserIdentityService,
    private readonly oauthState: OAuthStateService,
  ) {}

  private getClientConfig(clientId: AuthClientId): ClientConfig {
    const prefix = clientId === "portfolio" ? "PORTFOLIO" : "MCP";
    const githubClientId = requiredEnv(
      clientId === "portfolio"
        ? "PORTFOLIO_GITHUB_OAUTH_CLIENT_ID"
        : "GITHUB_OAUTH_CLIENT_ID",
    );
    const githubClientSecret = requiredEnv(
      clientId === "portfolio"
        ? "PORTFOLIO_GITHUB_OAUTH_CLIENT_SECRET"
        : "GITHUB_OAUTH_CLIENT_SECRET",
    );
    const redirectUri = requiredEnv(`${prefix}_GITHUB_REDIRECT_URI`);
    const audience = requiredEnv(
      clientId === "portfolio" ? "PORTFOLIO_AUTH_AUDIENCE" : "MCP_RESOURCE_URL",
    );
    const allowedGithubUserIds = requiredEnv(
      `${prefix}_AUTHORIZED_GITHUB_USER_IDS`,
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      githubClientId,
      githubClientSecret,
      redirectUri,
      audience,
      scope: clientId === "portfolio" ? "portfolio:use" : "resume:use",
      allowedGithubUserIds,
    };
  }

  private getSigningKey() {
    const privateKey = createPrivateKey(
      requiredEnv("AUTH_PRIVATE_KEY").replace(/\\n/g, "\n"),
    );
    if (
      privateKey.asymmetricKeyType !== "rsa" ||
      (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    ) {
      throw new Error("공용 인증 서명 키는 2048비트 이상의 RSA 키여야 합니다.");
    }
    const publicKey = createPublicKey(privateKey);
    const jwk = publicKey.export({ format: "jwk" });
    const fingerprint = createHash("sha256")
      .update(publicKey.export({ format: "der", type: "spki" }))
      .digest("hex");
    return {
      privateKey,
      publicKey,
      jwk,
      keyId: fingerprint.slice(0, 24),
    };
  }

  async issueServiceAccessToken(
    clientId: string,
    secret: string,
    scope?: string,
  ) {
    const expectedId = process.env.SERVICE_OAUTH_CLIENT_ID;
    const expectedSecret = process.env.SERVICE_OAUTH_CLIENT_SECRET;
    if (
      !expectedId?.trim() ||
      !expectedSecret?.trim() ||
      !clientId ||
      !secret ||
      !timingSafeEqual(
        createHash("sha256").update(clientId).digest(),
        createHash("sha256").update(expectedId).digest(),
      ) ||
      !timingSafeEqual(
        createHash("sha256").update(secret).digest(),
        createHash("sha256").update(expectedSecret).digest(),
      )
    ) {
      throw new UnauthorizedException({ error: "invalid_client" });
    }
    const grantedScope = scope ?? "project:write";
    if (!["project:write", "auth:manage"].includes(grantedScope))
      throw new BadRequestException({ error: "invalid_scope" });
    try {
      const audience = requiredEnv("SERVICE_OAUTH_AUDIENCE");
      const issuer = requiredEnv("AUTH_ISSUER");
      const { privateKey, keyId } = this.getSigningKey();
      const expiresAt = new Date(Date.now() + 900_000);
      const history = await this.prisma.authHistory.create({
        data: {
          clientId: "service",
          oauthClientId: clientId,
          userId: null,
          audience,
          scope: grantedScope,
          status: AuthHistoryStatus.authenticated,
          expiresAt,
        },
      });
      const accessToken = sign(
        { scope: grantedScope, client_id: clientId, sid: history.id },
        privateKey,
        {
          algorithm: "RS256",
          keyid: keyId,
          subject: clientId,
          audience,
          issuer,
          expiresIn: 900,
        },
      );
      return {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 900,
        scope: grantedScope,
      };
    } catch {
      throw new ServiceUnavailableException(
        "서비스 토큰을 발급할 수 없습니다.",
      );
    }
  }

  async validateProjectServiceToken(token: string): Promise<void> {
    return this.validateOAuthServiceToken(token, "project:write");
  }

  async validateOAuthServiceToken(
    token: string,
    requiredScope: "project:write" | "auth:manage",
  ): Promise<void> {
    const clientId = process.env.SERVICE_OAUTH_CLIENT_ID;
    const audience = process.env.SERVICE_OAUTH_AUDIENCE;
    if (!clientId?.trim() || !audience?.trim())
      throw new UnauthorizedException();
    let claims: JwtPayload;
    try {
      const verified = verifyJwt(token, this.getSigningKey().publicKey, {
        algorithms: ["RS256"],
        issuer: requiredEnv("AUTH_ISSUER"),
        audience,
      });
      if (
        typeof verified === "string" ||
        verified.sub !== clientId ||
        verified.client_id !== clientId ||
        verified.scope !== requiredScope ||
        typeof verified.sid !== "string" ||
        typeof verified.exp !== "number" ||
        typeof verified.iat !== "number" ||
        verified.iat > Date.now() / 1000 + 60
      )
        throw new UnauthorizedException();
      claims = verified;
    } catch {
      throw new UnauthorizedException();
    }
    const history = await this.prisma.authHistory
      .findUnique({ where: { id: claims.sid } })
      .catch(() => {
        throw new ServiceUnavailableException(
          "서비스 인증 상태를 확인할 수 없습니다.",
        );
      });
    if (
      !history ||
      history.clientId !== "service" ||
      history.oauthClientId !== clientId ||
      history.userId !== null ||
      history.audience !== audience ||
      history.scope !== requiredScope ||
      history.status !== AuthHistoryStatus.authenticated ||
      history.revokedAt !== null ||
      history.expiresAt <= new Date()
    )
      throw new UnauthorizedException();
  }

  getJwks() {
    const { jwk, keyId } = this.getSigningKey();
    return { keys: [{ ...jwk, kid: keyId, use: "sig", alg: "RS256" }] };
  }

  async introspectMcpAccessToken(token: string) {
    const config = this.getClientConfig("mcp");
    const issuer = requiredEnv("AUTH_ISSUER");
    const { publicKey } = this.getSigningKey();
    let claims: JwtPayload;
    try {
      const verified = verifyJwt(token, publicKey, {
        algorithms: ["RS256"],
        issuer,
        audience: config.audience,
      });
      if (typeof verified === "string") return { active: false };
      claims = verified;
    } catch {
      return { active: false };
    }

    if (
      typeof claims.sid !== "string" ||
      typeof claims.sub !== "string" ||
      !/^\d+$/.test(claims.sub) ||
      !Number.isSafeInteger(Number(claims.sub)) ||
      typeof claims.exp !== "number" ||
      typeof claims.iat !== "number" ||
      claims.iat > Math.floor(Date.now() / 1000) + 60 ||
      claims.scope !== config.scope
    ) {
      return { active: false };
    }

    const history = await this.prisma.authHistory.findUnique({
      where: { id: claims.sid },
    });
    const active =
      history?.clientId === "mcp" &&
      history.userId === Number(claims.sub) &&
      history.audience === config.audience &&
      history.scope === config.scope &&
      history.status === AuthHistoryStatus.authenticated &&
      history.revokedAt === null &&
      history.expiresAt > new Date();
    if (!active) return { active: false };

    return {
      active: true,
      client_id: "mcp",
      sub: claims.sub,
      aud: config.audience,
      iss: issuer,
      exp: claims.exp,
      iat: claims.iat,
      scope: config.scope,
    };
  }

  getOAuthMetadata() {
    const issuer = requiredEnv("AUTH_ISSUER").replace(/\/$/, "");
    return {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      grant_types_supported: [
        "authorization_code",
        "refresh_token",
        "client_credentials",
      ],
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
      token_endpoint_auth_methods_supported: [
        "none",
        "client_secret_basic",
        "client_secret_post",
      ],
      scopes_supported: ["resume:use", "project:write", "auth:manage"],
    };
  }

  registerOAuthClient(input: unknown) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new BadRequestException({ error: "invalid_client_metadata" });
    }
    const body = input as Record<string, unknown>;
    const redirectUris = body.redirect_uris;
    const grantTypes = body.grant_types ?? ["authorization_code"];
    const responseTypes = body.response_types ?? ["code"];
    if (
      !Array.isArray(redirectUris) ||
      redirectUris.length === 0 ||
      redirectUris.length > 10 ||
      redirectUris.some(
        (uri) => typeof uri !== "string" || !isValidRedirectUri(uri),
      ) ||
      new Set(redirectUris).size !== redirectUris.length ||
      !Array.isArray(grantTypes) ||
      grantTypes.length === 0 ||
      grantTypes.some(
        (grant) =>
          typeof grant !== "string" ||
          !["authorization_code", "refresh_token"].includes(grant),
      ) ||
      !grantTypes.includes("authorization_code") ||
      new Set(grantTypes).size !== grantTypes.length ||
      JSON.stringify(responseTypes) !== JSON.stringify(["code"]) ||
      (body.token_endpoint_auth_method !== undefined &&
        body.token_endpoint_auth_method !== "none") ||
      (body.client_name !== undefined &&
        (typeof body.client_name !== "string" || body.client_name.length > 128))
    ) {
      throw new BadRequestException({ error: "invalid_client_metadata" });
    }

    const client: OAuthClient = {
      redirect_uris: redirectUris as string[],
      grant_types: grantTypes as string[],
      response_types: ["code"],
      ...(typeof body.client_name === "string"
        ? { client_name: body.client_name }
        : {}),
    };
    const payload = Buffer.from(JSON.stringify(client)).toString("base64url");
    const signature = createHmac(
      "sha256",
      requiredEnv("MCP_AUTH_SERVICE_TOKEN"),
    )
      .update(payload)
      .digest("base64url");
    return {
      client_id: `${payload}.${signature}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      ...client,
      token_endpoint_auth_method: "none",
    };
  }

  private decodeOAuthClient(clientId: string): OAuthClient | null {
    const [payload, receivedSignature, extra] = clientId.split(".");
    if (!payload || !receivedSignature || extra) return null;
    const expectedSignature = createHmac(
      "sha256",
      requiredEnv("MCP_AUTH_SERVICE_TOKEN"),
    )
      .update(payload)
      .digest("base64url");
    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(receivedSignature);
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      return null;
    }
    try {
      const client = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as OAuthClient;
      if (
        !Array.isArray(client.redirect_uris) ||
        !Array.isArray(client.grant_types) ||
        !client.grant_types.includes("authorization_code") ||
        !client.response_types?.includes("code")
      ) {
        return null;
      }
      return client;
    } catch {
      return null;
    }
  }

  async startMcpOAuthAuthorization(input: {
    client_id: string;
    redirect_uri: string;
    state: string;
    code_challenge: string;
    code_challenge_method: string;
    resource: string;
    scope: string;
  }) {
    const client = this.decodeOAuthClient(input.client_id);
    const config = this.getClientConfig("mcp");
    if (
      !client ||
      !client.redirect_uris.includes(input.redirect_uri) ||
      !/^[A-Za-z0-9._~:-]{8,512}$/.test(input.state) ||
      !/^[A-Za-z0-9_-]{43}$/.test(input.code_challenge) ||
      input.code_challenge_method !== "S256" ||
      input.resource !== config.audience ||
      input.scope.split(/\s+/).filter(Boolean).join(" ") !== config.scope
    ) {
      throw new BadRequestException({ error: "invalid_request" });
    }

    const now = new Date();
    const state = randomBytes(32).toString("base64url");
    const stateExpiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS);
    await this.prisma.authHistory.deleteMany({
      where: {
        status: AuthHistoryStatus.pending,
        expiresAt: { lt: now },
      },
    });
    await this.prisma.authHistory.create({
      data: {
        clientId: "mcp",
        userId: null,
        redirectUri: config.redirectUri,
        oauthClientId: input.client_id,
        oauthRedirectUri: input.redirect_uri,
        oauthState: input.state,
        codeChallenge: input.code_challenge,
        stateHash: hashToken(state),
        stateExpiresAt,
        stateConsumedAt: null,
        audience: config.audience,
        scope: config.scope,
        status: AuthHistoryStatus.pending,
        expiresAt: stateExpiresAt,
      },
    });
    const authorizationUrl = new URL(
      "https://github.com/login/oauth/authorize",
    );
    authorizationUrl.searchParams.set("client_id", config.githubClientId);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("scope", "read:user");
    authorizationUrl.searchParams.set("state", state);
    return { authorizationUrl: authorizationUrl.toString() };
  }

  async createOAuthState(clientId: AuthClientId) {
    const config = this.getClientConfig(clientId);
    const state = await this.oauthState.issue(clientId, config.redirectUri);
    const authorizationUrl = new URL(
      "https://github.com/login/oauth/authorize",
    );
    authorizationUrl.searchParams.set("client_id", config.githubClientId);
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizationUrl.searchParams.set("scope", "read:user");
    authorizationUrl.searchParams.set("state", state);
    return { state, authorizationUrl: authorizationUrl.toString() };
  }

  consumeOAuthState(state: string, clientId: AuthClientId) {
    return this.oauthState.consume(state, clientId);
  }

  validateServiceToken(
    clientId: AuthClientId,
    token: string | undefined,
  ): void {
    if (clientId !== "mcp") throw new UnauthorizedException();
    const expected = process.env.MCP_AUTH_SERVICE_TOKEN;
    if (!expected?.trim() || !token) throw new UnauthorizedException();
    const actualDigest = createHash("sha256").update(token).digest();
    const expectedDigest = createHash("sha256").update(expected).digest();
    if (!timingSafeEqual(actualDigest, expectedDigest)) {
      throw new UnauthorizedException();
    }
  }

  private async markAuthenticationFailed(authHistoryId: string) {
    await this.prisma.authHistory.updateMany({
      where: { id: authHistoryId, status: AuthHistoryStatus.pending },
      data: { status: AuthHistoryStatus.failed },
    });
  }

  private async authenticateGitHubUser(
    config: ClientConfig,
    code: string,
    redirectUri: string,
  ) {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: { accept: "application/json" },
        body: new URLSearchParams({
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );
    if (!tokenResponse.ok) throw new UnauthorizedException();
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
    };
    if (!tokenPayload.access_token) throw new UnauthorizedException();

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${tokenPayload.access_token}`,
        "x-github-api-version": "2022-11-28",
      },
    });
    if (!profileResponse.ok) throw new UnauthorizedException();
    const profile = (await profileResponse.json()) as {
      id?: unknown;
      email?: unknown;
      name?: unknown;
      avatar_url?: unknown;
    };
    if (typeof profile.id !== "number" || !Number.isSafeInteger(profile.id)) {
      throw new UnauthorizedException("GitHub 사용자를 확인하지 못했습니다.");
    }
    const providerUserId = String(profile.id);
    if (!config.allowedGithubUserIds.includes(providerUserId)) {
      throw new UnauthorizedException();
    }
    return this.userIdentity.resolveGitHubUser({
      providerUserId,
      email: typeof profile.email === "string" ? profile.email : null,
      name: typeof profile.name === "string" ? profile.name : null,
      imageUrl:
        typeof profile.avatar_url === "string" ? profile.avatar_url : null,
    });
  }

  async completeMcpOAuthCallback(code: string, state: string) {
    const history = await this.consumeOAuthState(state, "mcp");
    if (
      !history.oauthClientId ||
      !history.oauthRedirectUri ||
      !history.oauthState ||
      !history.codeChallenge ||
      !history.audience ||
      !history.scope
    ) {
      await this.markAuthenticationFailed(history.id);
      throw new UnauthorizedException();
    }

    if (!code) {
      await this.markAuthenticationFailed(history.id);
      return {
        redirectUri: history.oauthRedirectUri,
        clientState: history.oauthState,
        error: "access_denied",
        issuer: requiredEnv("AUTH_ISSUER"),
      };
    }

    const config = this.getClientConfig("mcp");
    let user: Awaited<ReturnType<UserIdentityService["resolveGitHubUser"]>>;
    try {
      user = await this.authenticateGitHubUser(
        config,
        code,
        history.redirectUri!,
      );
    } catch (error) {
      await this.markAuthenticationFailed(history.id);
      if (error instanceof UnauthorizedException) {
        return {
          redirectUri: history.oauthRedirectUri,
          clientState: history.oauthState,
          error: "access_denied",
          issuer: requiredEnv("AUTH_ISSUER"),
        };
      }
      throw error;
    }

    const now = new Date();
    const codeExpiresAt = new Date(now.getTime() + 60_000);
    const updated = await this.prisma.authHistory.updateMany({
      where: {
        id: history.id,
        clientId: "mcp",
        status: AuthHistoryStatus.pending,
        userId: null,
        stateConsumedAt: { not: null },
        stateExpiresAt: { gt: now },
      },
      data: {
        userId: user.id,
        stateExpiresAt: codeExpiresAt,
        expiresAt: codeExpiresAt,
      },
    });
    if (updated.count !== 1) throw new UnauthorizedException();
    return {
      redirectUri: history.oauthRedirectUri,
      clientState: history.oauthState,
      code: state,
      issuer: requiredEnv("AUTH_ISSUER"),
    };
  }

  async exchangeMcpOAuthAuthorizationCode(input: {
    code: string;
    client_id: string;
    redirect_uri: string;
    code_verifier: string;
    resource: string;
  }): Promise<OAuthTokenResponse> {
    const client = this.decodeOAuthClient(input.client_id);
    if (!client) {
      throw new UnauthorizedException({ error: "invalid_client" });
    }
    const challenge = /^[A-Za-z0-9._~-]{43,128}$/.test(input.code_verifier)
      ? createHash("sha256").update(input.code_verifier).digest("base64url")
      : "";
    const history = await this.prisma.authHistory.findUnique({
      where: { stateHash: hashToken(input.code) },
    });
    const now = new Date();
    if (
      !client.redirect_uris.includes(input.redirect_uri) ||
      !history ||
      !client.grant_types.includes("authorization_code") ||
      history.clientId !== "mcp" ||
      history.oauthClientId !== input.client_id ||
      history.oauthRedirectUri !== input.redirect_uri ||
      history.codeChallenge !== challenge ||
      history.audience !== input.resource ||
      history.status !== AuthHistoryStatus.pending ||
      history.userId === null ||
      !history.scope ||
      !history.stateConsumedAt ||
      !history.stateExpiresAt ||
      history.stateExpiresAt <= now ||
      history.revokedAt
    ) {
      throw new UnauthorizedException();
    }

    const hasRefreshGrant = client.grant_types.includes("refresh_token");
    const tokenExpiresAt = new Date(
      now.getTime() +
        (hasRefreshGrant
          ? REFRESH_TOKEN_TTL_MS
          : ACCESS_TOKEN_TTL_SECONDS * 1000),
    );
    const refreshToken = hasRefreshGrant
      ? randomBytes(48).toString("base64url")
      : undefined;
    const activated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.authHistory.updateMany({
        where: {
          id: history.id,
          clientId: "mcp",
          status: AuthHistoryStatus.pending,
          userId: history.userId,
          stateConsumedAt: { not: null },
          stateExpiresAt: { gt: now },
          oauthClientId: input.client_id,
          oauthRedirectUri: input.redirect_uri,
          codeChallenge: challenge,
          audience: input.resource,
          revokedAt: null,
        },
        data: {
          status: AuthHistoryStatus.authenticated,
          expiresAt: tokenExpiresAt,
        },
      });
      if (updated.count !== 1) return false;
      if (refreshToken) {
        await tx.userToken.create({
          data: {
            authHistoryId: history.id,
            tokenHash: hashToken(refreshToken),
            expiresAt: tokenExpiresAt,
          },
        });
      }
      return true;
    });
    if (!activated || history.userId === null)
      throw new UnauthorizedException();
    return refreshToken
      ? this.issueTokens(
          history.userId,
          history.id,
          input.resource,
          history.scope,
          refreshToken,
          tokenExpiresAt,
        )
      : this.issueTokens(
          history.userId,
          history.id,
          input.resource,
          history.scope,
        );
  }

  async exchangeGitHubCode(
    clientId: AuthClientId,
    code: string,
    state: string,
  ) {
    const history = await this.consumeOAuthState(state, clientId);
    const config = this.getClientConfig(clientId);
    let user: Awaited<ReturnType<UserIdentityService["resolveGitHubUser"]>>;
    try {
      user = await this.authenticateGitHubUser(
        config,
        code,
        history.redirectUri!,
      );
    } catch (error) {
      await this.markAuthenticationFailed(history.id);
      throw error;
    }

    const refreshToken = randomBytes(48).toString("base64url");
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const activated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.authHistory.updateMany({
        where: {
          id: history.id,
          clientId,
          status: AuthHistoryStatus.pending,
          userId: null,
          stateConsumedAt: { not: null },
          revokedAt: null,
        },
        data: {
          userId: user.id,
          audience: config.audience,
          scope: config.scope,
          status: AuthHistoryStatus.authenticated,
          expiresAt: refreshExpiresAt,
        },
      });
      if (updated.count !== 1) return false;
      await tx.userToken.create({
        data: {
          authHistoryId: history.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: refreshExpiresAt,
        },
      });
      return true;
    });
    if (!activated) throw new UnauthorizedException();
    return this.issueTokens(
      user.id,
      history.id,
      config.audience,
      config.scope,
      refreshToken,
      refreshExpiresAt,
    );
  }

  private async revokeHistory(authHistoryId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authHistory.updateMany({
        where: {
          id: authHistoryId,
          status: { not: AuthHistoryStatus.revoked },
        },
        data: { status: AuthHistoryStatus.revoked, revokedAt: now },
      }),
      this.prisma.userToken.updateMany({
        where: { authHistoryId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async refresh(
    clientId: AuthClientId,
    refreshToken: string,
    oauthClientId?: string,
  ) {
    const tokenHash = hashToken(refreshToken);
    const token = await this.prisma.userToken.findUnique({
      where: { tokenHash },
      include: { authHistory: true },
    });
    if (
      !token ||
      token.authHistory.clientId !== clientId ||
      (oauthClientId && token.authHistory.oauthClientId !== oauthClientId)
    ) {
      throw new UnauthorizedException();
    }
    const history = token.authHistory;
    if (token.consumedAt || token.revokedAt) {
      await this.revokeHistory(history.id);
      throw new UnauthorizedException("Refresh token 재사용이 감지되었습니다.");
    }
    if (
      history.status !== AuthHistoryStatus.authenticated ||
      history.revokedAt ||
      history.userId === null ||
      !history.audience ||
      !history.scope ||
      token.expiresAt <= new Date() ||
      history.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException();
    }

    const nextToken = randomBytes(48).toString("base64url");
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const rotated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.userToken.updateMany({
        where: {
          id: token.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.userToken.create({
        data: {
          authHistoryId: history.id,
          tokenHash: hashToken(nextToken),
          expiresAt: nextExpiresAt,
        },
      });
      await tx.authHistory.update({
        where: { id: history.id },
        data: { expiresAt: nextExpiresAt },
      });
      return true;
    });
    if (!rotated) {
      await this.revokeHistory(history.id);
      throw new UnauthorizedException("Refresh token 재사용이 감지되었습니다.");
    }
    return this.issueTokens(
      history.userId,
      history.id,
      history.audience,
      history.scope,
      nextToken,
      nextExpiresAt,
    );
  }

  async refreshOAuthToken(clientId: string, refreshToken: string) {
    const client = this.decodeOAuthClient(clientId);
    if (!client) {
      throw new UnauthorizedException({ error: "invalid_client" });
    }
    if (!client.grant_types.includes("refresh_token")) {
      throw new UnauthorizedException();
    }
    return this.refresh("mcp", refreshToken, clientId);
  }

  async revoke(clientId: AuthClientId, refreshToken: string) {
    const token = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { authHistory: true },
    });
    if (!token || token.authHistory.clientId !== clientId) return;
    await this.revokeHistory(token.authHistoryId);
  }

  async revokeOAuthToken(clientId: string, refreshToken: string) {
    const client = this.decodeOAuthClient(clientId);
    if (!client) throw new UnauthorizedException();
    const token = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { authHistory: true },
    });
    if (
      token?.authHistory.clientId === "mcp" &&
      token.authHistory.oauthClientId === clientId
    ) {
      await this.revokeHistory(token.authHistoryId);
    }
    return {};
  }

  private issueTokens(
    userId: number,
    sessionId: string,
    audience: string,
    scope: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_at: string;
    scope: string;
  };
  private issueTokens(
    userId: number,
    sessionId: string,
    audience: string,
    scope: string,
  ): {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  };
  private issueTokens(
    userId: number,
    sessionId: string,
    audience: string,
    scope: string,
    refreshToken?: string,
    refreshExpiresAt?: Date,
  ) {
    const issuer = requiredEnv("AUTH_ISSUER");
    const { privateKey, keyId } = this.getSigningKey();
    const accessToken = sign({ scope, sid: sessionId }, privateKey, {
      algorithm: "RS256",
      keyid: keyId,
      subject: String(userId),
      audience,
      issuer,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      ...(refreshToken && refreshExpiresAt
        ? {
            refresh_token: refreshToken,
            refresh_expires_at: refreshExpiresAt.toISOString(),
          }
        : {}),
      scope,
    };
  }
}
