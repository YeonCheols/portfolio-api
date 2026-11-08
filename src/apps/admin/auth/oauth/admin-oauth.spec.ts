import { adminAppRedirectUrl, readCookie } from "./admin-oauth";

describe("readCookie", () => {
  it("여러 쿠키 중 이름이 정확히 같은 값만 읽는다", () => {
    const header = "a=1; admin_oauth_state=abc; x_admin_oauth_state=zzz";

    expect(readCookie(header, "admin_oauth_state")).toBe("abc");
  });

  it.each([undefined, "", "other=1", "admin_oauth_state"])(
    "쿠키가 없거나 값이 없으면 undefined를 돌려준다 (%j)",
    (header) => {
      expect(readCookie(header, "admin_oauth_state")).toBeUndefined();
    },
  );
});

describe("adminAppRedirectUrl", () => {
  const original = process.env.ADMIN_APP_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_APP_URL;
    else process.env.ADMIN_APP_URL = original;
  });

  it("관리자 앱 주소 기준으로 고정 경로와 오류 코드만 붙인다", () => {
    process.env.ADMIN_APP_URL = "https://admin.example.com";

    expect(adminAppRedirectUrl("/")).toBe("https://admin.example.com/");
    expect(adminAppRedirectUrl("/login", "ACCESS_DENIED")).toBe(
      "https://admin.example.com/login?error=ACCESS_DENIED",
    );
  });

  it("관리자 앱 주소가 없으면 실패한다", () => {
    delete process.env.ADMIN_APP_URL;

    expect(() => adminAppRedirectUrl("/")).toThrow("ADMIN_APP_URL");
  });
});
