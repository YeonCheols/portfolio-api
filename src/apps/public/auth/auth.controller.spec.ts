import { BadRequestException } from "@nestjs/common";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  const service = {
    getJwks: jest.fn(),
    createOAuthState: jest.fn(),
    exchangeGitHubCode: jest.fn(),
    refresh: jest.fn(),
    revoke: jest.fn(),
  };
  let controller: AuthController;
  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(service as never);
  });

  it("지원하지 않는 client_id를 거부한다", () => {
    expect(() =>
      controller.authorize({ client_id: "unknown" as never }),
    ).toThrow(BadRequestException);
    expect(service.createOAuthState).not.toHaveBeenCalled();
  });
  it("code/state가 없는 callback을 거부한다", () => {
    expect(() =>
      controller.callback({ client_id: "mcp", code: "code" }),
    ).toThrow(BadRequestException);
    expect(() => controller.callback(undefined as never)).toThrow(
      BadRequestException,
    );
    expect(service.exchangeGitHubCode).not.toHaveBeenCalled();
  });
  it("refresh token이 없는 요청을 거부한다", () => {
    expect(() => controller.refresh({ client_id: "mcp" })).toThrow(
      BadRequestException,
    );
    expect(() => controller.refresh(undefined as never)).toThrow(
      BadRequestException,
    );
    expect(service.refresh).not.toHaveBeenCalled();
  });
});
