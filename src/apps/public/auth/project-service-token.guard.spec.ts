import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ProjectServiceTokenGuard } from "./project-service-token.guard";

const contextWith = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization } }),
    }),
  }) as ExecutionContext;
describe("ProjectServiceTokenGuard", () => {
  it("공통 Bearer 토큰을 검증하고 없거나 잘못된 헤더는 거부한다", async () => {
    const service = {
      validateProjectServiceToken: jest.fn().mockResolvedValue(undefined),
    };
    const guard = new ProjectServiceTokenGuard(
      service as unknown as AuthService,
    );
    await expect(
      guard.canActivate(contextWith("Bearer service-access")),
    ).resolves.toBe(true);
    expect(service.validateProjectServiceToken).toHaveBeenCalledWith(
      "service-access",
    );
    for (const header of [
      undefined,
      "Bearer",
      "Basic invalid",
      "Bearer one two",
    ]) {
      await expect(guard.canActivate(contextWith(header))).rejects.toThrow(
        UnauthorizedException,
      );
    }
    expect(service.validateProjectServiceToken).toHaveBeenCalledTimes(1);
  });
});
