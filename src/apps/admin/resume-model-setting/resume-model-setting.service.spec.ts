import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminResumeModelSettingService } from "./resume-model-setting.service";

describe("AdminResumeModelSettingService", () => {
  let service: AdminResumeModelSettingService;
  const prisma = {
    resumeModelSetting: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const input = {
    environment: "production",
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    secretRef: "RESUME_MODEL_TOKEN_OPENROUTER",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminResumeModelSettingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AdminResumeModelSettingService);
  });

  describe("create", () => {
    it("검증한 필드를 비활성 상태로 저장한다", async () => {
      prisma.resumeModelSetting.create.mockResolvedValue({ id: 1 });

      await expect(
        service.create({ ...input, isActive: true }),
      ).resolves.toEqual({ id: 1 });
      expect(prisma.resumeModelSetting.create).toHaveBeenCalledWith({
        data: { ...input, isActive: false },
      });
    });
  });

  describe("findAll", () => {
    it("환경별로 최근 수정한 순서로 목록을 반환한다", async () => {
      const rows = [{ id: 2 }, { id: 1 }];
      prisma.resumeModelSetting.findMany.mockResolvedValue(rows);

      await expect(service.findAll()).resolves.toEqual(rows);
      expect(prisma.resumeModelSetting.findMany).toHaveBeenCalledWith({
        orderBy: [{ environment: "asc" }, { updatedAt: "desc" }],
      });
    });
  });

  describe("update", () => {
    it("비활성 설정이면 기존 환경을 유지한 채 검증한 필드를 저장한다", async () => {
      prisma.resumeModelSetting.findUnique.mockResolvedValue({
        id: 1,
        environment: "development",
        isActive: false,
      });
      prisma.resumeModelSetting.update.mockResolvedValue({ id: 1 });

      await expect(
        service.update(1, { ...input, environment: "production" }),
      ).resolves.toEqual({ id: 1 });
      expect(prisma.resumeModelSetting.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { ...input, environment: "development" },
      });
    });

    it("설정이 없으면 NotFoundException을 던지고 저장하지 않는다", async () => {
      prisma.resumeModelSetting.findUnique.mockResolvedValue(null);

      await expect(service.update(9, input)).rejects.toThrow(NotFoundException);
      expect(prisma.resumeModelSetting.update).not.toHaveBeenCalled();
    });

    it("활성 설정이면 BadRequestException을 던지고 저장하지 않는다", async () => {
      prisma.resumeModelSetting.findUnique.mockResolvedValue({
        id: 1,
        environment: "production",
        isActive: true,
      });

      await expect(service.update(1, input)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.resumeModelSetting.update).not.toHaveBeenCalled();
    });
  });

  describe("activate", () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(
        (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma),
      );
    });

    it("한 트랜잭션에서 같은 환경의 기존 활성을 먼저 끄고 대상을 켠다", async () => {
      prisma.resumeModelSetting.findUnique.mockResolvedValue({
        id: 2,
        environment: "production",
        isActive: false,
      });
      prisma.resumeModelSetting.update.mockResolvedValue({
        id: 2,
        isActive: true,
      });

      await expect(service.activate(2)).resolves.toEqual({
        id: 2,
        isActive: true,
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.resumeModelSetting.updateMany).toHaveBeenCalledWith({
        where: { environment: "production", isActive: true, NOT: { id: 2 } },
        data: { isActive: false },
      });
      expect(prisma.resumeModelSetting.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { isActive: true },
      });
      expect(
        prisma.resumeModelSetting.updateMany.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prisma.resumeModelSetting.update.mock.invocationCallOrder[0],
      );
    });

    it("설정이 없으면 NotFoundException을 던지고 다른 활성을 끄지 않는다", async () => {
      prisma.resumeModelSetting.findUnique.mockResolvedValue(null);

      await expect(service.activate(9)).rejects.toThrow(NotFoundException);
      expect(prisma.resumeModelSetting.updateMany).not.toHaveBeenCalled();
      expect(prisma.resumeModelSetting.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("활성 설정이면 BadRequestException을 던지고 삭제하지 않는다", async () => {
      prisma.resumeModelSetting.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
      });

      await expect(service.remove(1)).rejects.toThrow(BadRequestException);
      expect(prisma.resumeModelSetting.delete).not.toHaveBeenCalled();
    });

    it("비활성 설정이면 삭제한다", async () => {
      prisma.resumeModelSetting.findUnique.mockResolvedValue({
        id: 3,
        isActive: false,
      });
      prisma.resumeModelSetting.delete.mockResolvedValue({ id: 3 });

      await expect(service.remove(3)).resolves.toEqual({ id: 3 });
      expect(prisma.resumeModelSetting.delete).toHaveBeenCalledWith({
        where: { id: 3, isActive: false },
      });
    });
  });
});
