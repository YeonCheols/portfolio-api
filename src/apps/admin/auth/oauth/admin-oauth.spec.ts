import {
  adminAppRedirectUrl,
  resolveAdminAppUrl,
  readCookie,
} from "./admin-oauth";

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

describe("resolveAdminAppUrl", () => {
  const original = process.env.ADMIN_APP_URL;

  beforeEach(() => {
    process.env.ADMIN_APP_URL = "https://admin.example.com";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_APP_URL;
    else process.env.ADMIN_APP_URL = original;
  });

  it.each([
    ["https://admin.example.com", "https://admin.example.com"],
    ["https://admin.example.com/login?x=1", "https://admin.example.com"],
    ["http://localhost:5001", "http://localhost:5001"],
    ["http://localhost:5001/some/path", "http://localhost:5001"],
  ])("허용 범위의 %s는 origin만 쓴다", (requested, expected) => {
    expect(resolveAdminAppUrl(requested)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "not a url",
    "https://evil.example.com",
    "https://admin.example.com.evil.com",
    "https://localhost:5001",
    "http://localhost.evil.com",
    "http://127.0.0.1:5001",
    "javascript:alert(1)",
  ])("허용 범위 밖의 %s는 기본 관리자 앱 주소로 돌린다", (requested) => {
    expect(resolveAdminAppUrl(requested)).toBe("https://admin.example.com");
  });

  it("기준 주소가 없으면 실패한다", () => {
    delete process.env.ADMIN_APP_URL;

    expect(() => resolveAdminAppUrl("http://localhost:5001")).toThrow(
      "ADMIN_APP_URL",
    );
  });

  it("adminAppRedirectUrl은 넘겨받은 기준 주소에 고정 경로만 붙인다", () => {
    expect(adminAppRedirectUrl("/", undefined, "http://localhost:5001")).toBe(
      "http://localhost:5001/",
    );
    expect(
      adminAppRedirectUrl("/login", "AUTH_FAILED", "http://localhost:5001"),
    ).toBe("http://localhost:5001/login?error=AUTH_FAILED");
  });
});
