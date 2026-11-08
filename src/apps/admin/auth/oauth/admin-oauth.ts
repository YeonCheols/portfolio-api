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
