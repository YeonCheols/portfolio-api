import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminTagService } from "./tag.service";

describe("AdminTagService", () => {
  let service: AdminTagService;
  const prisma = {
    tag: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
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

  describe("create", () => {
    it("태그를 생성한다", async () => {
      const data = {
        name: "react",
        icon: "react",
        color: "#61dafb",
        category: "frontend",
      };

      await service.create(data as never);

      expect(prisma.tag.create).toHaveBeenCalledWith({ data });
    });
  });

  describe("findAll", () => {
    it("최근 수정순으로 조회한다", async () => {
      prisma.tag.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        orderBy: { updatedAt: "desc" },
      });
    });
  });

  describe("findSearch", () => {
    beforeEach(() => {
      prisma.tag.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.tag.count.mockResolvedValueOnce(1).mockResolvedValueOnce(20);
    });

    it("page, size가 없으면 1페이지 10개로 조회하고 전체 개수를 반환한다", async () => {
      const result = await service.findSearch({} as never);

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 10 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ allTotal: 20, page: 1, size: 10 }),
      );
    });

    it("filteredTotal에 검색 조건에 맞는 전체 개수를 담는다", async () => {
      const result = await service.findSearch({ keyword: "Re" } as never);

      expect(prisma.tag.count).toHaveBeenNthCalledWith(1, {
        where: {
          name: { contains: "Re", mode: Prisma.QueryMode.insensitive },
        },
      });
      expect(result).toEqual(
        expect.objectContaining({ total: 1, filteredTotal: 1, allTotal: 20 }),
      );
    });

    it("keyword가 있으면 이름을 대소문자 구분 없이 검색한다", async () => {
      await service.findSearch({
        keyword: "Re",
        page: "2",
        size: "5",
      } as never);

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: { contains: "Re", mode: Prisma.QueryMode.insensitive },
          },
          skip: 5,
          take: 5,
        }),
      );
    });
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

  describe("update / remove", () => {
    it("이름으로 태그를 수정한다", async () => {
      await service.update("react", { color: "#000" } as never);

      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { name: "react" },
        data: { color: "#000" },
      });
    });

    it("이름으로 태그를 삭제한다", async () => {
      await service.remove("react");

      expect(prisma.tag.delete).toHaveBeenCalledWith({
        where: { name: "react" },
      });
    });
  });
});
