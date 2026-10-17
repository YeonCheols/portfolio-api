import { ArgumentsHost, UnauthorizedException } from "@nestjs/common";
import { AuthExceptionFilter } from "./auth.exception.filter";

describe("AuthExceptionFilter", () => {
  it("인증 실패를 401과 한국어 안내 메시지로 응답한다", () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new AuthExceptionFilter().catch(new UnauthorizedException(), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      message: "인증에 실패했습니다. 로그인이 필요합니다",
      error: "unauthorized user",
    });
  });
});
