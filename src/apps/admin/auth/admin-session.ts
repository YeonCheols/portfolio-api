import * as jwt from "jsonwebtoken";
import { getAdminJwtSecret } from "./jwt-secret";

export const ADMIN_ACCESS_TOKEN_COOKIE = "access_token";
export const ADMIN_ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 24 * 1000;

export const adminAuthCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  domain: ".ycseng.com",
} as const;

/** 비밀번호 로그인과 OAuth 로그인이 같은 관리자 토큰을 발급하도록 한 곳에 둡니다. */
export const signAdminAccessToken = (admin: {
  id: number;
  email: string;
}): string =>
  jwt.sign({ sub: admin.id, email: admin.email }, getAdminJwtSecret(), {
    expiresIn: "1d",
  });
