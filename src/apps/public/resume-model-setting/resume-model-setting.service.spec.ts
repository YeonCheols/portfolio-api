import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaService } from "src/prisma/prisma.service";
import { ResumeModelSettingService } from "./resume-model-setting.service";

describe("ResumeModelSettingService", () => {
  let service: ResumeModelSettingService;
  const prisma = {
    resumeModelSetting: { findFirst: jest.fn() },
  };
  const active = {
    provider: "openrouter",
    modelName: "anthropic/claude-sonnet-5.5",
    url: "https://openrouter.ai/api/v1/chat/completions",
    secretRef: "RESUME_MODEL_TOKEN_OPENROUTER",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResumeModelSettingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ResumeModelSettingService);
  });

  describe("findActive", () => {
    it("환경의 활성 설정을 네 필드만 골라 조회한다", async () => {
      prisma.resumeModelSetting.findFirst.mockResolvedValue(active);

      await expect(service.findActive("production")).resolves.toEqual(active);
      expect(prisma.resumeModelSetting.findFirst).toHaveBeenCalledWith({
        where: { environment: "production", isActive: true },
        select: { provider: true, modelName: true, url: true, secretRef: true },
      });
    });

    it.each(["staging", "", undefined, ["production"]])(
      "환경이 %p이면 BadRequestException을 던지고 조회하지 않는다",
      async (environment) => {
        await expect(service.findActive(environment)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.resumeModelSetting.findFirst).not.toHaveBeenCalled();
      },
    );

    it("활성 설정이 없으면 다른 환경으로 대체하지 않고 NotFoundException을 던진다", async () => {
      prisma.resumeModelSetting.findFirst.mockResolvedValue(null);

      await expect(service.findActive("development")).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.resumeModelSetting.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});
