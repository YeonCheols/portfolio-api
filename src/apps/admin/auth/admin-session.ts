import * as jwt from "jsonwebtoken";
import { getAdminJwtSecret } from "./jwt-secret";

export const ADMIN_ACCESS_TOKEN_COOKIE = "access_token";
export const ADMIN_ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 24 * 1000;

/**
 * 관리자 앱이 localhost일 때만 로컬 개발용 쿠키를 씁니다. 운영 도메인(.ycseng.com)의 secure 쿠키는
 * localhost로 전달되지 않기 때문입니다. 운영 값은 ADMIN_APP_URL이 localhost가 아니면 그대로입니다.
 */
export const isLocalAdminApp = (): boolean => {
  try {
    return new URL(process.env.ADMIN_APP_URL ?? "").hostname === "localhost";
  } catch {
    return false;
  }
};

export const adminAuthCookieOptions = isLocalAdminApp()
  ? ({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    } as const)
  : ({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      domain: ".ycseng.com",
    } as const);

/** 비밀번호 로그인과 OAuth 로그인이 같은 관리자 토큰을 발급하도록 한 곳에 둡니다. */
export const signAdminAccessToken = (admin: {
  id: number;
  email: string;
}): string =>
  jwt.sign({ sub: admin.id, email: admin.email }, getAdminJwtSecret(), {
    expiresIn: "1d",
  });
