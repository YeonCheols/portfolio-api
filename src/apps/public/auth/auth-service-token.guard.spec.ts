import { ExecutionContext } from "@nestjs/common";
import { AuthServiceTokenGuard } from "./auth-service-token.guard";

describe("AuthServiceTokenGuard", () => {
  const service = {
    validateServiceToken: jest.fn(),
    validateOAuthServiceToken: jest.fn().mockResolvedValue(undefined),
  };
  const guard = new AuthServiceTokenGuard(service as never);
  beforeEach(() => jest.clearAllMocks());

  it("MCP의 기존 Bearer 서비스 토큰 검증은 유지한다", async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: "Bearer app-token" },
          body: { client_id: "mcp" },
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(service.validateServiceToken).toHaveBeenCalledWith(
      "mcp",
      "app-token",
    );
  });
  it("client_id 또는 Bearer token이 없으면 거부한다", async () => {
    service.validateServiceToken.mockImplementation(() => {
      throw new Error("unauthorized");
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: "Basic x" }, body: {} }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow("Unauthorized");
  });
});

it("비MCP 인증 요청은 고정 토큰 대신 auth:manage OAuth access token을 검증한다", async () => {
  const service = {
    validateServiceToken: jest.fn(),
    validateOAuthServiceToken: jest.fn().mockResolvedValue(undefined),
  };
  const guard = new AuthServiceTokenGuard(service as never);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: "Bearer oauth-access" },
        body: { client_id: "portfolio" },
      }),
    }),
  } as unknown as ExecutionContext;
  await guard.canActivate(context);
  expect(service.validateOAuthServiceToken).toHaveBeenCalledWith(
    "oauth-access",
    "auth:manage",
  );
  expect(service.validateServiceToken).not.toHaveBeenCalled();
});
