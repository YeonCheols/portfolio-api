import { Logger, ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "src/prisma/prisma.service";
import { DB_CHECK_TIMEOUT_MS, HealthService } from "./health.service";

describe("HealthService", () => {
  let service: HealthService;
  let logError: jest.SpyInstance;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useRealTimers();
    logError = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  describe("check", () => {
    it("DB를 조회하지 않고 앱 상태 ok를 반환한다", () => {
      expect(service.check()).toEqual({ status: "ok" });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe("checkDb", () => {
    it("SELECT 1이 성공하면 db up과 응답 시간을 반환한다", async () => {
      prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const result = await service.checkDb();

      expect(result).toEqual({
        status: "ok",
        db: "up",
        latencyMs: expect.any(Number),
      });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("쿼리가 실패하면 원인 메시지를 숨긴 503을 던지고 원인은 로그로 남긴다", async () => {
      prisma.$queryRaw.mockRejectedValue(
        new Error("password authentication failed for user postgres"),
      );

      const error = await service.checkDb().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        status: "error",
        db: "down",
      });
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining("password authentication failed"),
      );
    });

    it("쿼리가 제한 시간 안에 끝나지 않으면 503을 던진다", async () => {
      jest.useFakeTimers();
      prisma.$queryRaw.mockReturnValue(new Promise(() => undefined));

      const pending = service.checkDb().catch((e: unknown) => e);
      await jest.advanceTimersByTimeAsync(DB_CHECK_TIMEOUT_MS);
      const error = await pending;

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        status: "error",
        db: "down",
      });
    });
  });
});
