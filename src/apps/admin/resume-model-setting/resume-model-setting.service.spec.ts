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
    modelName: "vendor/model",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: "fake-provider-api-key",
  } as const;
  const row = {
    id: 1,
    ...input,
    secretRef: "legacy-reference",
    isActive: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
  const publicResult = (value: unknown) => {
    expect(value).toEqual(
      expect.objectContaining({
        id: 1,
        modelName: input.modelName,
        hasApiKey: true,
      }),
    );
    expect(value).not.toHaveProperty("apiKey");
    expect(value).not.toHaveProperty("secretRef");
    expect(JSON.stringify(value)).not.toContain(input.apiKey);
  };
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AdminResumeModelSettingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AdminResumeModelSettingService);
    prisma.$transaction.mockImplementation(
      (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma),
    );
  });
  it("생성 시 실제 키를 저장하지만 응답에는 등록 여부만 반환한다", async () => {
    prisma.resumeModelSetting.create.mockResolvedValue(row);
    publicResult(await service.create({ ...input, isActive: true }));
    expect(prisma.resumeModelSetting.create).toHaveBeenCalledWith({
      data: { ...input, isActive: false },
    });
  });
  it("저장소 오류에 실제 키가 있어도 외부 오류에 노출하지 않는다", async () => {
    prisma.resumeModelSetting.create.mockRejectedValue(
      new Error("failed: " + input.apiKey),
    );
    await expect(service.create(input)).rejects.not.toThrow(input.apiKey);
  });

  it("목록은 환경별 최근 순서로 조회하고 활성 여부와 관계없이 실제 키를 포함하되 이전 참조는 제거한다", async () => {
    prisma.resumeModelSetting.findMany.mockResolvedValue([
      row,
      { ...row, id: 2, apiKey: null },
    ]);
    const rows = await service.findAll();
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: 1,
        modelName: input.modelName,
        hasApiKey: true,
        apiKey: input.apiKey,
      }),
    );
    expect(rows[0]).not.toHaveProperty("secretRef");
    expect(rows[1]).toEqual(
      expect.objectContaining({ hasApiKey: false, apiKey: null }),
    );
    expect(prisma.resumeModelSetting.findMany).toHaveBeenCalledWith({
      orderBy: [{ environment: "asc" }, { updatedAt: "desc" }],
    });
  });
  it("비활성 설정 수정은 환경을 보존하고 새 키를 저장한다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue({
      ...row,
      environment: "development",
    });
    prisma.resumeModelSetting.update.mockResolvedValue({
      ...row,
      environment: "development",
    });
    publicResult(await service.update(1, input));
    expect(prisma.resumeModelSetting.update).toHaveBeenCalledWith({
      where: { id: 1, isActive: false },
      data: { ...input, environment: "development" },
    });
  });
  it("키를 생략한 수정은 기존 키를 덮어쓰지 않는다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue(row);
    prisma.resumeModelSetting.update.mockResolvedValue(row);
    const metadata = {
      environment: input.environment,
      provider: input.provider,
      modelName: input.modelName,
      url: input.url,
    };
    publicResult(await service.update(1, metadata));
    expect(
      prisma.resumeModelSetting.update.mock.calls[0][0].data,
    ).not.toHaveProperty("apiKey");
  });
  it("설정이 없으면 수정하지 않는다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue(null);
    await expect(service.update(1, input)).rejects.toThrow(NotFoundException);
    expect(prisma.resumeModelSetting.update).not.toHaveBeenCalled();
  });
  it("활성 설정은 수정하지 않는다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue({
      ...row,
      isActive: true,
    });
    await expect(service.update(1, input)).rejects.toThrow(BadRequestException);
    expect(prisma.resumeModelSetting.update).not.toHaveBeenCalled();
  });
  it("키가 준비된 대상을 활성화하며 같은 환경의 기존 활성만 먼저 해제한다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue(row);
    prisma.resumeModelSetting.update.mockResolvedValue({
      ...row,
      isActive: true,
    });
    publicResult(await service.activate(1));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.resumeModelSetting.updateMany).toHaveBeenCalledWith({
      where: { environment: "production", isActive: true, NOT: { id: 1 } },
      data: { isActive: false },
    });
    expect(
      prisma.resumeModelSetting.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      prisma.resumeModelSetting.update.mock.invocationCallOrder[0],
    );
  });
  it("키가 없는 기존 설정은 활성화하지 않고 다른 활성도 유지한다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue({
      ...row,
      apiKey: null,
    });
    await expect(service.activate(1)).rejects.toThrow(BadRequestException);
    expect(prisma.resumeModelSetting.updateMany).not.toHaveBeenCalled();
    expect(prisma.resumeModelSetting.update).not.toHaveBeenCalled();
  });
  it("대상이 없으면 활성화하지 않는다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue(null);
    await expect(service.activate(1)).rejects.toThrow(NotFoundException);
    expect(prisma.resumeModelSetting.updateMany).not.toHaveBeenCalled();
  });
  it("활성 설정은 삭제하지 않는다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue({
      ...row,
      isActive: true,
    });
    await expect(service.remove(1)).rejects.toThrow(BadRequestException);
    expect(prisma.resumeModelSetting.delete).not.toHaveBeenCalled();
  });
  it("비활성 설정을 삭제하고 응답에는 실제 키를 포함하지 않는다", async () => {
    prisma.resumeModelSetting.findUnique.mockResolvedValue(row);
    prisma.resumeModelSetting.delete.mockResolvedValue(row);
    publicResult(await service.remove(1));
    expect(prisma.resumeModelSetting.delete).toHaveBeenCalledWith({
      where: { id: 1, isActive: false },
    });
  });
});
