import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "src/apps/public/auth/auth.service";
import { AdminOrMcpServiceGuard } from "./admin-or-mcp-service.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  }) as unknown as ExecutionContext;

describe("AdminOrMcpServiceGuard", () => {
  const authService = {
    validateServiceToken: jest.fn((_clientId: string, token?: string) => {
      if (token !== "service-token") throw new UnauthorizedException();
    }),
  };
  const guard = new AdminOrMcpServiceGuard(
    authService as unknown as AuthService,
  );
  let jwtCanActivate: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtCanActivate = jest
      .spyOn(JwtAuthGuard.prototype, "canActivate")
      .mockResolvedValue(true);
  });

  afterEach(() => {
    jwtCanActivate.mockRestore();
  });

  it("MCP 서비스 토큰이면 관리자 JWT 검증 없이 통과시킨다", () => {
    expect(guard.canActivate(contextWith("Bearer service-token"))).toBe(true);
    expect(authService.validateServiceToken).toHaveBeenCalledWith(
      "mcp",
      "service-token",
    );
    expect(jwtCanActivate).not.toHaveBeenCalled();
  });

  it("서비스 토큰이 아니면 기존 관리자 JWT 검증으로 넘기고 그 결과를 그대로 따른다", async () => {
    const cases = [
      contextWith(undefined),
      contextWith("Bearer admin-jwt"),
      contextWith("Basic service-token"),
    ];

    for (const context of cases) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }
    expect(jwtCanActivate).toHaveBeenCalledTimes(3);

    jwtCanActivate.mockRejectedValueOnce(new UnauthorizedException());
    await expect(
      guard.canActivate(contextWith("Bearer wrong-token")),
    ).rejects.toThrow(UnauthorizedException);
  });
});
