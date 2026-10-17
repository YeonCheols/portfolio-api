import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { TagService } from "./tag.service";

describe("TagService", () => {
  let service: TagService;
  const prisma = {
    tag: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const tagRow = {
    id: 1,
    name: "React",
    icon: "react",
    color: "#61dafb",
    category: "frontend",
    updatedAt: new Date("2026-01-01"),
    _count: { projectTags: 3 },
  };
  const tagResponse = {
    id: 1,
    name: "React",
    icon: "react",
    color: "#61dafb",
    category: "frontend",
    updatedAt: new Date("2026-01-01"),
    projectCount: 3,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [TagService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TagService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findAll", () => {
    it("노출 프로젝트 수를 projectCount로 바꿔 반환한다", async () => {
      prisma.tag.findMany.mockResolvedValue([tagRow]);

      await expect(service.findAll()).resolves.toEqual([tagResponse]);
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: {
              select: {
                projectTags: { where: { project: { isShow: true } } },
              },
            },
          }),
          orderBy: { name: "asc" },
        }),
      );
    });

    it("5분 안에 다시 호출하면 캐시를 반환하고 DB를 조회하지 않는다", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
      prisma.tag.findMany.mockResolvedValue([tagRow]);

      await service.findAll();
      now.mockReturnValue(1_000_000 + 5 * 60 * 1000 - 1);
      await expect(service.findAll()).resolves.toEqual([tagResponse]);

      expect(prisma.tag.findMany).toHaveBeenCalledTimes(1);
    });

    it("5분이 지나면 DB를 다시 조회한다", async () => {
      const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
      prisma.tag.findMany.mockResolvedValue([tagRow]);

      await service.findAll();
      now.mockReturnValue(1_000_000 + 5 * 60 * 1000);
      await service.findAll();

      expect(prisma.tag.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe("findSearch", () => {
    beforeEach(() => {
      prisma.tag.findMany.mockResolvedValue([tagRow]);
      prisma.tag.count.mockResolvedValueOnce(1).mockResolvedValueOnce(12);
    });

    it("검색 결과의 projectCount와 페이징 정보를 반환한다", async () => {
      await expect(service.findSearch({} as never)).resolves.toEqual({
        data: [tagResponse],
        total: 1,
        filteredTotal: 1,
        allTotal: 12,
        page: 1,
        size: 10,
      });
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 10 }),
      );
    });

    it("keyword가 있으면 이름을 대소문자 구분 없이 검색한다", async () => {
      await service.findSearch({
        keyword: "re",
        page: "3",
        size: "2",
      } as never);

      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: { contains: "re", mode: Prisma.QueryMode.insensitive },
          },
          skip: 4,
          take: 2,
        }),
      );
    });
  });

  describe("getTagProjectCounts", () => {
    it("노출 프로젝트에 쓰인 태그만 조회하고 projectCount로 바꿔 반환한다", async () => {
      prisma.tag.findMany.mockResolvedValue([
        { id: 1, name: "React", _count: { projectTags: 3 } },
      ]);

      await expect(service.getTagProjectCounts()).resolves.toEqual([
        { id: 1, name: "React", projectCount: 3 },
      ]);
      expect(prisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectTags: { some: { project: { isShow: true } } } },
          orderBy: { name: "asc" },
        }),
      );
    });
  });
});
