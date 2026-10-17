import { Test } from "@nestjs/testing";
import { PrismaService } from "src/prisma/prisma.service";
import { ProfileService } from "./profile.service";

describe("ProfileService", () => {
  let service: ProfileService;
  const prisma = {
    profile: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ProfileService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ProfileService);
  });

  describe("findOne", () => {
    it("활성 프로필 중 order가 가장 큰 프로필을 반환한다", async () => {
      const profile = { id: 1, isActive: true };
      prisma.profile.findFirst.mockResolvedValue(profile);

      await expect(service.findOne()).resolves.toEqual(profile);
      expect(prisma.profile.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ order: "desc" }],
      });
    });

    it("활성 프로필이 없으면 null을 반환한다", async () => {
      prisma.profile.findFirst.mockResolvedValue(null);

      await expect(service.findOne()).resolves.toBeNull();
    });
  });
});
