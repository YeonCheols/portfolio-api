import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ResumeModelSettingTokenGuard } from "./resume-model-setting-token.guard";

describe("ResumeModelSettingTokenGuard", () => {
  const originalToken = process.env.RESUME_MODEL_SETTING_TOKEN;
  const guard = new ResumeModelSettingTokenGuard();
  const contextWith = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as unknown as ExecutionContext;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.RESUME_MODEL_SETTING_TOKEN;
      return;
    }
    process.env.RESUME_MODEL_SETTING_TOKEN = originalToken;
  });

  it.each([undefined, "", "   "])(
    "서버 조회 토큰이 %p이면 맞는 형식의 요청도 거부한다",
    (serverToken) => {
      if (serverToken === undefined) {
        delete process.env.RESUME_MODEL_SETTING_TOKEN;
      } else {
        process.env.RESUME_MODEL_SETTING_TOKEN = serverToken;
      }

      expect(() =>
        guard.canActivate(contextWith(`Bearer ${serverToken ?? ""}`)),
      ).toThrow(UnauthorizedException);
    },
  );

  it.each([
    ["헤더가 없으면", undefined],
    ["토큰이 틀리면", "Bearer wrong-token"],
    ["관리자 JWT이면", "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.sig"],
    ["Bearer 접두사가 없으면", "read-token"],
    ["토큰 뒤에 문자가 붙으면", "Bearer read-tokenx"],
  ])("%s 거부한다", (_label, authorization) => {
    process.env.RESUME_MODEL_SETTING_TOKEN = "read-token";

    expect(() => guard.canActivate(contextWith(authorization))).toThrow(
      UnauthorizedException,
    );
  });

  it("서버 조회 토큰과 같은 Bearer 토큰이면 통과한다", () => {
    process.env.RESUME_MODEL_SETTING_TOKEN = "read-token";

    expect(guard.canActivate(contextWith("Bearer read-token"))).toBe(true);
  });
});
