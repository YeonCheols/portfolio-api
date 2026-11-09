import { isLocalAdminApp } from "../admin-session";

export const ADMIN_OAUTH_PROVIDERS = ["google", "github"] as const;
export type AdminOAuthProvider = (typeof ADMIN_OAUTH_PROVIDERS)[number];

export const isAdminOAuthProvider = (
  value: string,
): value is AdminOAuthProvider =>
  (ADMIN_OAUTH_PROVIDERS as readonly string[]).includes(value);

/** 관리자 앱에 전달하는 안전한 거절 코드입니다. 공급자 오류 원문은 담지 않습니다. */
export type AdminOAuthErrorCode = "ACCESS_DENIED" | "AUTH_FAILED";

export class AdminOAuthError extends Error {
  constructor(readonly code: AdminOAuthErrorCode) {
    super(code);
    this.name = "AdminOAuthError";
  }
}

const configuredAdminAppUrl = (): string => {
  const base = process.env.ADMIN_APP_URL?.trim();
  if (!base) throw new Error("ADMIN_APP_URL 환경 변수가 설정되지 않았습니다.");
  return base;
};

/**
 * 로그인을 시작한 관리자 앱의 주소입니다. 관리자 앱이 알려 준 값이 ADMIN_APP_URL과 같은 origin이거나
 * http://localhost일 때만 쓰고, 그 외에는 ADMIN_APP_URL로 돌립니다. 이동 주소에는 토큰이 실리지
 * 않고(오류 코드만) 허용 범위 밖의 주소는 받지 않아 열린 리다이렉트가 생기지 않습니다.
 */
export const resolveAdminAppUrl = (requested?: string | null): string => {
  const configured = configuredAdminAppUrl();
  if (!requested) return configured;
  try {
    const candidate = new URL(requested);
    const isConfigured = candidate.origin === new URL(configured).origin;
    const isLocal =
      candidate.protocol === "http:" && candidate.hostname === "localhost";
    return isConfigured || isLocal ? candidate.origin : configured;
  } catch {
    return configured;
  }
};

/**
 * 로그인 결과를 돌려보낼 관리자 앱 주소입니다. 이동 경로는 `/`와 `/login` 두 곳으로 고정하고
 * 기준 주소는 resolveAdminAppUrl이 검증한 값만 받습니다.
 */
export const adminAppRedirectUrl = (
  path: "/" | "/login",
  error?: AdminOAuthErrorCode,
  appUrl: string = configuredAdminAppUrl(),
): string => {
  const url = new URL(path, appUrl);
  if (error) url.searchParams.set("error", error);
  return url.toString();
};

/**
 * 시작한 브라우저와 콜백을 묶는 state 쿠키입니다. 공격자가 자기 계정으로 시작한 콜백 주소를
 * 피해자가 열어도 피해자 브라우저에는 이 쿠키가 없어 거절됩니다. 공급자에서 돌아오는 최상위
 * 이동에 실려야 하므로 SameSite=Lax입니다.
 */
export const ADMIN_OAUTH_STATE_COOKIE = "admin_oauth_state";
export const adminOAuthStateCookieOptions = {
  httpOnly: true,
  secure: !isLocalAdminApp(),
  sameSite: "lax",
  path: "/admin/auth/oauth",
} as const;
export const ADMIN_OAUTH_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

/** 로그인을 시작한 관리자 앱 주소를 콜백까지 들고 가는 단기 쿠키입니다. state 쿠키와 같은 옵션을 씁니다. */
export const ADMIN_OAUTH_APP_COOKIE = "admin_oauth_app";

export const readCookie = (
  header: string | undefined,
  name: string,
): string | undefined => {
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
};
