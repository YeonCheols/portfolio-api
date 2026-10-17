import { Test } from "@nestjs/testing";
import { HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminProfileService } from "./profile.service";

describe("AdminProfileService", () => {
  let service: AdminProfileService;
  const prisma = {
    profile: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminProfileService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AdminProfileService);
  });

  describe("create", () => {
    it("활성 프로필이 이미 있으면 400 에러를 던지고 생성하지 않는다", async () => {
      prisma.profile.count.mockResolvedValue(1);

      const error = await service
        .create({ isActive: true } as never)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(prisma.profile.create).not.toHaveBeenCalled();
    });

    it("활성 프로필이 없으면 활성 상태로 생성한다", async () => {
      prisma.profile.count.mockResolvedValue(0);
      const profile = { id: 1, isActive: true };
      prisma.profile.create.mockResolvedValue(profile);

      await expect(
        service.create({ isActive: true } as never),
      ).resolves.toEqual({
        status: 200,
        message: "프로필 생성 success",
        data: profile,
      });
      expect(prisma.profile.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it("비활성으로 생성하면 활성 프로필 개수를 확인하지 않는다", async () => {
      prisma.profile.create.mockResolvedValue({ id: 1 });

      await service.create({ isActive: false } as never);

      expect(prisma.profile.count).not.toHaveBeenCalled();
      expect(prisma.profile.create).toHaveBeenCalled();
    });
  });

  describe("findAll / findOne", () => {
    it("id, order 내림차순으로 조회한다", async () => {
      prisma.profile.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.profile.findMany).toHaveBeenCalledWith({
        orderBy: [{ id: "desc" }, { order: "desc" }],
      });
    });

    it("문자열 id를 숫자로 바꿔 조회한다", async () => {
      await service.findOne("3" as never);

      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { id: 3 },
      });
    });
  });

  describe("update", () => {
    it("활성으로 수정할 때 자기 자신을 제외한 활성 프로필을 센다", async () => {
      prisma.profile.count.mockResolvedValue(0);
      prisma.profile.update.mockResolvedValue({ id: 3 });

      await expect(
        service.update("3" as never, { isActive: true } as never),
      ).resolves.toEqual({
        status: 200,
        message: "프로필 수정 success",
        data: { id: 3 },
      });
      expect(prisma.profile.count).toHaveBeenCalledWith({
        where: { isActive: true, id: { not: 3 } },
      });
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 3 },
        data: { isActive: true },
      });
    });

    it("다른 활성 프로필이 있으면 수정하지 않는다", async () => {
      prisma.profile.count.mockResolvedValue(1);

      await expect(
        service.update(3, { isActive: true } as never),
      ).rejects.toThrow(HttpException);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });
  });

  describe("updateStatus", () => {
    it("다른 활성 프로필이 없으면 상태를 수정한다", async () => {
      prisma.profile.count.mockResolvedValue(0);

      await expect(
        service.updateStatus(2, { isActive: true } as never),
      ).resolves.toEqual({ status: 200, message: "상태 업데이트 success" });
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { isActive: true },
      });
    });

    it("다른 활성 프로필이 있으면 상태를 수정하지 않는다", async () => {
      prisma.profile.count.mockResolvedValue(1);

      await expect(
        service.updateStatus(2, { isActive: true } as never),
      ).rejects.toThrow(HttpException);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });
  });

  describe("updateOrder / remove", () => {
    it("정렬 순서를 수정한다", async () => {
      const data = { id: "4", order: 2 };

      await expect(service.updateOrder(data as never)).resolves.toEqual({
        status: 200,
        message: "정렬 수정 success",
      });
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data,
      });
    });

    it("문자열 id를 숫자로 바꿔 삭제한다", async () => {
      await expect(service.remove("5" as never)).resolves.toEqual({
        status: 200,
        message: "프로필 삭제 success",
      });
      expect(prisma.profile.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });
});
