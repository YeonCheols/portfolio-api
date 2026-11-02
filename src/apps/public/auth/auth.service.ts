import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { sign } from "jsonwebtoken";
import { AuthHistoryStatus } from "@prisma/client";
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
    return { privateKey, jwk, keyId: fingerprint.slice(0, 24) };
  }

  getJwks() {
    const { jwk, keyId } = this.getSigningKey();
    return { keys: [{ ...jwk, kid: keyId, use: "sig", alg: "RS256" }] };
  }

  async createOAuthState(clientId: AuthClientId) {
    const config = this.getClientConfig(clientId);
    const now = new Date();
    await this.prisma.authHistory.deleteMany({
      where: {
        status: AuthHistoryStatus.pending,
        expiresAt: { lt: now },
      },
    });
    const state = randomBytes(32).toString("base64url");
    const stateExpiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS);
    await this.prisma.authHistory.create({
      data: {
        clientId,
        userId: null,
        redirectUri: config.redirectUri,
        stateHash: hashToken(state),
        stateExpiresAt,
        stateConsumedAt: null,
        audience: null,
        scope: null,
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
    return { state, authorizationUrl: authorizationUrl.toString() };
  }

  async consumeOAuthState(state: string, clientId: AuthClientId) {
    const record = await this.prisma.authHistory.findUnique({
      where: { stateHash: hashToken(state) },
    });
    if (
      !record ||
      record.clientId !== clientId ||
      record.status !== AuthHistoryStatus.pending ||
      record.userId !== null ||
      record.stateConsumedAt ||
      !record.stateExpiresAt ||
      record.stateExpiresAt <= new Date() ||
      !record.redirectUri
    ) {
      throw new UnauthorizedException();
    }
    const consumed = await this.prisma.authHistory.updateMany({
      where: {
        id: record.id,
        clientId,
        status: AuthHistoryStatus.pending,
        userId: null,
        stateConsumedAt: null,
        stateExpiresAt: { gt: new Date() },
      },
      data: { stateConsumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException();
    return record;
  }

  validateServiceToken(
    clientId: AuthClientId,
    token: string | undefined,
  ): void {
    const expected =
      process.env[
        clientId === "portfolio"
          ? "PORTFOLIO_AUTH_SERVICE_TOKEN"
          : "MCP_AUTH_SERVICE_TOKEN"
      ];
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

  async exchangeGitHubCode(
    clientId: AuthClientId,
    code: string,
    state: string,
  ) {
    const history = await this.consumeOAuthState(state, clientId);
    const config = this.getClientConfig(clientId);
    let profile: {
      id?: unknown;
      email?: unknown;
      name?: unknown;
      avatar_url?: unknown;
    };
    try {
      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: { accept: "application/json" },
          body: new URLSearchParams({
            client_id: config.githubClientId,
            client_secret: config.githubClientSecret,
            code,
            redirect_uri: history.redirectUri!,
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
      profile = (await profileResponse.json()) as typeof profile;
    } catch (error) {
      await this.markAuthenticationFailed(history.id);
      throw error;
    }

    if (typeof profile.id !== "number" || !Number.isSafeInteger(profile.id)) {
      await this.markAuthenticationFailed(history.id);
      throw new UnauthorizedException("GitHub 사용자를 확인하지 못했습니다.");
    }
    const providerUserId = String(profile.id);
    if (!config.allowedGithubUserIds.includes(providerUserId)) {
      await this.markAuthenticationFailed(history.id);
      throw new UnauthorizedException();
    }

    let user: Awaited<ReturnType<UserIdentityService["resolveGitHubUser"]>>;
    try {
      user = await this.userIdentity.resolveGitHubUser({
        providerUserId,
        email: typeof profile.email === "string" ? profile.email : null,
        name: typeof profile.name === "string" ? profile.name : null,
        imageUrl:
          typeof profile.avatar_url === "string" ? profile.avatar_url : null,
      });
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

  async refresh(clientId: AuthClientId, refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const token = await this.prisma.userToken.findUnique({
      where: { tokenHash },
      include: { authHistory: true },
    });
    if (!token || token.authHistory.clientId !== clientId) {
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

  async revoke(clientId: AuthClientId, refreshToken: string): Promise<void> {
    const token = await this.prisma.userToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { authHistory: true },
    });
    if (!token || token.authHistory.clientId !== clientId) return;
    await this.revokeHistory(token.authHistoryId);
  }

  private issueTokens(
    userId: number,
    sessionId: string,
    audience: string,
    scope: string,
    refreshToken: string,
    refreshExpiresAt: Date,
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
      refresh_token: refreshToken,
      refresh_expires_at: refreshExpiresAt.toISOString(),
      scope,
    };
  }
}
