import { Injectable, Logger } from "@nestjs/common";
import { AuthHistoryStatus } from "@prisma/client";
import { OAuthStateService } from "src/apps/identity/oauth-state.service";
import { PrismaService } from "src/prisma/prisma.service";
import { signAdminAccessToken } from "../admin-session";
import { AdminOAuthError, AdminOAuthProvider } from "./admin-oauth";

const ADMIN_OAUTH_CLIENT_ID = "admin";

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value?.trim())
    throw new Error(`${name} 환경 변수가 설정되지 않았습니다.`);
  return value;
};

const providerConfig = (provider: AdminOAuthProvider): ProviderConfig => {
  const prefix = `ADMIN_${provider.toUpperCase()}`;
  return {
    clientId: requiredEnv(`${prefix}_OAUTH_CLIENT_ID`),
    clientSecret: requiredEnv(`${prefix}_OAUTH_CLIENT_SECRET`),
    redirectUri: requiredEnv(`${prefix}_REDIRECT_URI`),
  };
};

const fetchJson = async (url: string, init: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new AdminOAuthError("AUTH_FAILED");
  return response.json();
};

const bearer = (accessToken: string) => ({
  accept: "application/json",
  authorization: `Bearer ${accessToken}`,
});

const accessTokenOf = (payload: unknown): string => {
  const token = (payload as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== "string" || !token)
    throw new AdminOAuthError("AUTH_FAILED");
  return token;
};

/** 공급자가 검증한 이메일을 돌려줍니다. 검증된 이메일이 없으면 null입니다. */
const verifiedEmail: Record<
  AdminOAuthProvider,
  (config: ProviderConfig, code: string) => Promise<string | null>
> = {
  google: async (config, code) => {
    const token = accessTokenOf(
      await fetchJson("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { accept: "application/json" },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      }),
    );
    const profile = (await fetchJson(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: bearer(token) },
    )) as { email?: unknown; email_verified?: unknown } | null;
    return profile?.email_verified === true && typeof profile.email === "string"
      ? profile.email
      : null;
  },
  github: async (config, code) => {
    const token = accessTokenOf(
      await fetchJson("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { accept: "application/json" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
        }),
      }),
    );
    const emails = (await fetchJson("https://api.github.com/user/emails", {
      headers: {
        ...bearer(token),
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
      },
    })) as { email?: unknown; primary?: unknown; verified?: unknown }[] | null;
    const primary = Array.isArray(emails)
      ? emails.find((item) => item.primary === true && item.verified === true)
      : undefined;
    return typeof primary?.email === "string" ? primary.email : null;
  },
};

const authorizeEndpoint: Record<
  AdminOAuthProvider,
  { url: string; scope: string; extra?: Record<string, string> }
> = {
  google: {
    url: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email",
    extra: { response_type: "code", prompt: "select_account" },
  },
  github: {
    url: "https://github.com/login/oauth/authorize",
    scope: "user:email",
  },
};

@Injectable()
export class AdminOAuthService {
  private readonly logger = new Logger(AdminOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthState: OAuthStateService,
  ) {}

  async getAuthorizationUrl(
    provider: AdminOAuthProvider,
  ): Promise<{ url: string; state: string }> {
    const config = providerConfig(provider);
    const state = await this.oauthState.issue(
      ADMIN_OAUTH_CLIENT_ID,
      config.redirectUri,
    );
    const endpoint = authorizeEndpoint[provider];
    const url = new URL(endpoint.url);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("scope", endpoint.scope);
    url.searchParams.set("state", state);
    Object.entries(endpoint.extra ?? {}).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    return { url: url.toString(), state };
  }

  /**
   * 공급자가 검증한 이메일이 활성 관리자(AdminUser)와 같을 때만 기존 관리자 토큰을 발급합니다.
   * 실패 사유는 안전한 코드로만 알리고 공급자 응답 원문은 남기지 않습니다.
   */
  async signIn(provider: AdminOAuthProvider, code: string, state: string) {
    const history = await this.oauthState
      .consume(state, ADMIN_OAUTH_CLIENT_ID)
      .catch(() => {
        throw new AdminOAuthError("AUTH_FAILED");
      });

    try {
      const email = await verifiedEmail[provider](
        providerConfig(provider),
        code,
      );
      if (!email) throw new AdminOAuthError("ACCESS_DENIED");

      const admin = await this.prisma.adminUser.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      });
      if (!admin || !admin.isActive) throw new AdminOAuthError("ACCESS_DENIED");

      return {
        admin: { id: admin.id, email: admin.email },
        accessToken: signAdminAccessToken(admin),
      };
    } catch (error) {
      await this.markFailed(history.id);
      if (error instanceof AdminOAuthError) throw error;
      // 공급자·네트워크 오류 원문에는 토큰이 섞일 수 있어 종류만 기록하고 코드로 바꿉니다
      this.logger.warn(`관리자 OAuth 실패 provider=${provider}`);
      throw new AdminOAuthError("AUTH_FAILED");
    }
  }

  private markFailed(id: string) {
    return this.prisma.authHistory.updateMany({
      where: { id, status: AuthHistoryStatus.pending },
      data: { status: AuthHistoryStatus.failed },
    });
  }
}
