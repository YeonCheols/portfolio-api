import { Logger } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  let service: PrismaService;

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
});
