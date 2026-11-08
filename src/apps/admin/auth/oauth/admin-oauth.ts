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

/**
 * 로그인 결과를 돌려보낼 관리자 앱 주소입니다. 이동 경로는 `/`와 `/login` 두 곳으로 고정하고
 * 요청에서 받은 값은 쓰지 않아 열린 리다이렉트가 생기지 않습니다.
 */
export const adminAppRedirectUrl = (
  path: "/" | "/login",
  error?: AdminOAuthErrorCode,
): string => {
  const base = process.env.ADMIN_APP_URL?.trim();
  if (!base) throw new Error("ADMIN_APP_URL 환경 변수가 설정되지 않았습니다.");
  const url = new URL(path, base);
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
  secure: true,
  sameSite: "lax",
  path: "/admin/auth/oauth",
} as const;
export const ADMIN_OAUTH_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

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
