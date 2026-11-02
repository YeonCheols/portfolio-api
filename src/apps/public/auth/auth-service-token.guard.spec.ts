import { ExecutionContext } from "@nestjs/common";
import { AuthServiceTokenGuard } from "./auth-service-token.guard";

describe("AuthServiceTokenGuard", () => {
  const service = { validateServiceToken: jest.fn() };
  const guard = new AuthServiceTokenGuard(service as never);
  beforeEach(() => jest.clearAllMocks());

  it("client_id에 맞는 Bearer token을 검증한다", () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: "Bearer app-token" },
          body: { client_id: "portfolio" },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(service.validateServiceToken).toHaveBeenCalledWith(
      "portfolio",
      "app-token",
    );
  });
  it("client_id 또는 Bearer token이 없으면 거부한다", () => {
    service.validateServiceToken.mockImplementation(() => {
      throw new Error("unauthorized");
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: "Basic x" }, body: {} }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow("unauthorized");
  });
});
