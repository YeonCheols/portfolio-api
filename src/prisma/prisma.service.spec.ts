import { Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  const originalUrl = process.env.DATABASE_URL;
  let service: PrismaService;

  beforeAll(() => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new PrismaService();
  });

  describe("onModuleInit", () => {
    it("DB 연결에 성공하면 그대로 초기화를 마친다", async () => {
      const connect = jest
        .spyOn(service, "$connect")
        .mockResolvedValue(undefined);

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(connect).toHaveBeenCalledTimes(1);
    });

    it("DB 연결에 실패해도 앱 부팅을 막지 않고 에러를 로그로 남긴다", async () => {
      jest
        .spyOn(service, "$connect")
        .mockRejectedValue(new Error("Can't reach database server"));
      const logError = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining("Can't reach database server"),
      );
    });
  });

  describe("종료", () => {
    it("모듈이 내려가면 DB 연결을 끊는다", async () => {
      const disconnect = jest
        .spyOn(service, "$disconnect")
        .mockResolvedValue(undefined);

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it("프로세스 종료 전에 앱을 닫는다", async () => {
      const close = jest.fn();
      let onExit: (() => Promise<void>) | undefined;
      jest.spyOn(process, "on").mockImplementation(((
        event: string,
        listener: () => Promise<void>,
      ) => {
        if (event === "beforeExit") {
          onExit = listener;
        }
        return process;
      }) as typeof process.on);

      await service.enableShutdownHooks({ close } as never);
      await onExit?.();

      expect(close).toHaveBeenCalledTimes(1);
    });
  });
});
