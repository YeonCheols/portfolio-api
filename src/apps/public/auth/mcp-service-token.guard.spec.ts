import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { McpServiceTokenGuard } from "./mcp-service-token.guard";

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  }) as unknown as ExecutionContext;

describe("McpServiceTokenGuard", () => {
  const service = { validateServiceToken: jest.fn() };
  const guard = new McpServiceTokenGuard(service as unknown as AuthService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Bearer 서비스 토큰을 mcp 클라이언트 기준으로 검증하고 통과시킨다", () => {
    expect(guard.canActivate(contextWith("Bearer service-token"))).toBe(true);
    expect(service.validateServiceToken).toHaveBeenCalledWith(
      "mcp",
      "service-token",
    );
  });

  it("헤더가 없거나 Bearer가 아니면 토큰 없이 검증하고 실패 예외를 그대로 던진다", () => {
    service.validateServiceToken.mockImplementation(
      (_clientId: string, token?: string) => {
        if (!token) throw new UnauthorizedException();
      },
    );

    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.canActivate(contextWith("Basic service-token"))).toThrow(
      UnauthorizedException,
    );
    expect(service.validateServiceToken).toHaveBeenNthCalledWith(
      1,
      "mcp",
      undefined,
    );
    expect(service.validateServiceToken).toHaveBeenNthCalledWith(
      2,
      "mcp",
      undefined,
    );
  });
});
