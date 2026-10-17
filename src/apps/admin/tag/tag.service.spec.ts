import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminTagService } from "./tag.service";

describe("AdminTagService", () => {
  let service: AdminTagService;
  const prisma = {
    tag: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminTagService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AdminTagService);
  });

  describe("findOne", () => {
    it("태그가 있으면 해당 태그를 반환한다", async () => {
      const tag = { id: 1, name: "react" };
      prisma.tag.findUnique.mockResolvedValue(tag);

      await expect(service.findOne("react")).resolves.toEqual(tag);
      expect(prisma.tag.findUnique).toHaveBeenCalledWith({
        where: { name: "react" },
      });
    });

    it("태그가 없으면 NotFoundException을 던진다", async () => {
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.findOne("none")).rejects.toThrow(NotFoundException);
    });
  });
});
