import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { ProjectService } from "./project.service";

describe("ProjectService", () => {
  let service: ProjectService;
  const prisma = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    tag: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const tag = {
    id: 10,
    name: "React",
    icon: "react",
    color: "#61dafb",
    category: "frontend",
    updatedAt: new Date("2026-01-01"),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ProjectService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ProjectService);
  });

  describe("findAll", () => {
    it("노출 중인 프로젝트만 정렬해서 조회한다", async () => {
      prisma.project.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: { isShow: true },
        orderBy: [{ order: "desc" }, { updatedAt: "desc" }],
      });
    });
  });

  describe("finedSearch", () => {
    beforeEach(() => {
      prisma.project.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      prisma.project.count.mockResolvedValueOnce(5).mockResolvedValueOnce(7);
    });

    it("keyword가 없어도 노출 중인 프로젝트만 검색한다", async () => {
      const result = await service.finedSearch({} as never);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isShow: true }, skip: 0, take: 10 }),
      );
      expect(result).toEqual({
        data: [{ id: 1 }, { id: 2 }],
        total: 2,
        filteredTotal: 5,
        allTotal: 7,
        page: 1,
        size: 10,
      });
    });

    it("keyword가 있으면 노출 조건과 함께 제목/설명을 검색한다", async () => {
      await service.finedSearch({
        keyword: "api",
        page: "2",
        size: "4",
      } as never);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isShow: true,
            OR: [
              {
                title: {
                  contains: "api",
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: "api",
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
          skip: 4,
          take: 4,
        }),
      );
    });

    it("전체 개수는 노출 중인 프로젝트 기준으로 센다", async () => {
      await service.finedSearch({ keyword: "api" } as never);

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: { isShow: true },
      });
    });

    it("filteredTotal은 노출 조건과 검색어를 함께 적용해 센다", async () => {
      const result = await service.finedSearch({ keyword: "api" } as never);

      expect(prisma.project.count).toHaveBeenNthCalledWith(1, {
        where: expect.objectContaining({
          isShow: true,
          OR: expect.any(Array),
        }),
      });
      expect(result).toEqual(
        expect.objectContaining({ total: 2, filteredTotal: 5, allTotal: 7 }),
      );
    });
  });

  describe("findOne", () => {
    it("노출 중인 프로젝트만 slug로 조회한다", async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne("hidden")).resolves.toBeNull();
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { slug: "hidden", isShow: true },
      });
    });
  });

  describe("findTagsByStacks", () => {
    it("stacks에 있는 이름의 태그를 이름순으로 조회한다", async () => {
      prisma.tag.findMany.mockResolvedValue([tag]);

      await expect(
        service.findTagsByStacks('["React","Vue"]'),
      ).resolves.toEqual([tag]);
      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        where: { name: { in: ["React", "Vue"] } },
        orderBy: { name: "asc" },
      });
    });

    it("stacks가 JSON이 아니면 빈 배열을 반환한다", async () => {
      await expect(service.findTagsByStacks("React")).resolves.toEqual([]);
      expect(prisma.tag.findMany).not.toHaveBeenCalled();
    });
  });

  describe("findProjectsByTag", () => {
    it("태그를 사용하는 노출 프로젝트를 조회하고 projectTags를 태그 정보로 바꾼다", async () => {
      prisma.project.findMany.mockResolvedValue([
        { id: 1, slug: "p1", projectTags: [{ id: 100, tag }] },
      ]);

      const result = await service.findProjectsByTag("React");

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isShow: true,
            projectTags: { some: { tag: { name: "React" } } },
          },
        }),
      );
      expect(result).toEqual([{ id: 1, slug: "p1", projectTags: [tag] }]);
    });

    it("projectTags가 없으면 빈 배열로 반환한다", async () => {
      prisma.project.findMany.mockResolvedValue([{ id: 1 }]);

      await expect(service.findProjectsByTag("React")).resolves.toEqual([
        { id: 1, projectTags: [] },
      ]);
    });
  });

  describe("findProjectsByTags", () => {
    it("태그 중 하나라도 사용하는 노출 프로젝트를 조회한다", async () => {
      prisma.project.findMany.mockResolvedValue([
        { id: 1, projectTags: [{ id: 100, tag }] },
      ]);

      const result = await service.findProjectsByTags(["React", "Vue"]);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isShow: true,
            projectTags: { some: { tag: { name: { in: ["React", "Vue"] } } } },
          },
        }),
      );
      expect(result).toEqual([{ id: 1, projectTags: [tag] }]);
    });
  });
});
