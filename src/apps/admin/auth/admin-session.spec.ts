import * as jwt from "jsonwebtoken";
import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  adminAuthCookieOptions,
  signAdminAccessToken,
} from "./admin-session";

describe("admin-session", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it("관리자 id와 이메일을 담은 1일 만료 토큰을 발급한다", () => {
    const token = signAdminAccessToken({ id: 7, email: "admin@test.com" });

    const payload = jwt.verify(token, "test-secret") as jwt.JwtPayload;
    expect(payload).toMatchObject({ sub: 7, email: "admin@test.com" });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(60 * 60 * 24);
  });

  it("JWT_SECRET이 없으면 토큰을 발급하지 않는다", () => {
    delete process.env.JWT_SECRET;

    expect(() =>
      signAdminAccessToken({ id: 1, email: "admin@test.com" }),
    ).toThrow("JWT_SECRET");
  });

  it("쿠키는 httpOnly와 secure로 .ycseng.com 도메인에 둔다", () => {
    expect(ADMIN_ACCESS_TOKEN_COOKIE).toBe("access_token");
    expect(adminAuthCookieOptions).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      domain: ".ycseng.com",
    });
  });
});
