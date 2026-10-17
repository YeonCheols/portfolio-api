import { Test } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminProjectService } from "./project.service";

describe("AdminProjectService", () => {
  let service: AdminProjectService;
  const prisma = {
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tag: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    projectTag: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: typeof prisma) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminProjectService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AdminProjectService);
  });

  describe("create", () => {
    it("프로젝트를 생성하고 stacks의 태그와 관계를 만든다", async () => {
      const project = { id: 1, slug: "p1" };
      prisma.project.create.mockResolvedValue(project);
      prisma.tag.findUnique
        .mockResolvedValueOnce({ id: 10, name: "React" })
        .mockResolvedValueOnce(null);
      prisma.tag.create.mockResolvedValue({ id: 11, name: "NestJS" });
      prisma.projectTag.findUnique.mockResolvedValue(null);
      const data = { slug: "p1", stacks: '["React","NestJS"]' };

      await expect(service.create(data as never)).resolves.toEqual(project);

      expect(prisma.project.create).toHaveBeenCalledWith({ data });
      expect(prisma.tag.create).toHaveBeenCalledTimes(1);
      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: {
          name: "NestJS",
          icon: "default-icon",
          color: "#000000",
          category: "technology",
        },
      });
      expect(prisma.projectTag.create).toHaveBeenCalledWith({
        data: { projectId: 1, tagId: 10 },
      });
      expect(prisma.projectTag.create).toHaveBeenCalledWith({
        data: { projectId: 1, tagId: 11 },
      });
    });

    it("이미 있는 프로젝트-태그 관계는 다시 만들지 않는다", async () => {
      prisma.project.create.mockResolvedValue({ id: 1 });
      prisma.tag.findUnique.mockResolvedValue({ id: 10, name: "React" });
      prisma.projectTag.findUnique.mockResolvedValue({ id: 100 });

      await service.create({ stacks: '["React"]' } as never);

      expect(prisma.projectTag.findUnique).toHaveBeenCalledWith({
        where: { projectId_tagId: { projectId: 1, tagId: 10 } },
      });
      expect(prisma.projectTag.create).not.toHaveBeenCalled();
    });

    it("프로젝트 생성과 태그 연결을 한 트랜잭션에서 처리한다", async () => {
      prisma.project.create.mockResolvedValue({ id: 1 });
      prisma.tag.findUnique.mockResolvedValue({ id: 10, name: "React" });
      prisma.projectTag.findUnique.mockResolvedValue(null);

      await service.create({ stacks: '["React"]' } as never);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it.each([
      ["JSON이 아닌 문자열", "React"],
      ["배열이 아닌 JSON", '{"name":"React"}'],
      ["문자열이 아닌 원소", '["React",1]'],
    ])(
      "stacks가 %s이면 400 에러를 던지고 프로젝트를 만들지 않는다",
      async (_, stacks) => {
        await expect(service.create({ stacks } as never)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.project.create).not.toHaveBeenCalled();
      },
    );

    it("태그 연결이 실패하면 에러를 그대로 던진다", async () => {
      prisma.project.create.mockResolvedValue({ id: 1 });
      prisma.tag.findUnique.mockRejectedValue(new Error("db down"));

      await expect(
        service.create({ stacks: '["React"]' } as never),
      ).rejects.toThrow("db down");
    });
  });

  describe("findAll", () => {
    it("order, updatedAt 내림차순으로 조회한다", async () => {
      prisma.project.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        orderBy: [{ order: "desc" }, { updatedAt: "desc" }],
      });
    });
  });

  describe("findOne / findOverSlug", () => {
    it("slug로 프로젝트를 조회한다", async () => {
      const project = { id: 1, slug: "p1" };
      prisma.project.findUnique.mockResolvedValue(project);

      await expect(service.findOne("p1")).resolves.toEqual(project);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { slug: "p1" },
      });
    });

    it("slug 중복 개수를 반환한다", async () => {
      prisma.project.count.mockResolvedValue(1);

      await expect(service.findOverSlug("p1")).resolves.toBe(1);
      expect(prisma.project.count).toHaveBeenCalledWith({
        where: { slug: "p1" },
      });
    });
  });

  describe("update", () => {
    it("프로젝트가 없으면 404 에러를 던지고 수정하지 않는다", async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.update("none", {} as never)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it("바뀐 stacks가 문자열 배열 JSON이 아니면 400 에러를 던지고 수정하지 않는다", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 1,
        stacks: '["React"]',
      });

      await expect(
        service.update("p1", { stacks: "React" } as never),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it("태그 관계 갱신이 실패하면 에러를 그대로 던진다", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 1,
        stacks: '["React"]',
      });
      prisma.projectTag.findMany.mockRejectedValue(new Error("db down"));

      await expect(
        service.update("p1", { stacks: '["Vue"]' } as never),
      ).rejects.toThrow("db down");
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it("stacks가 바뀌지 않으면 태그 관계를 건드리지 않는다", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 1,
        stacks: '["React"]',
      });

      await expect(
        service.update("p1", { stacks: '["React"]', title: "t" } as never),
      ).resolves.toEqual({ status: 200, message: "프로젝트 업데이트 success" });

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { slug: "p1" },
        data: { stacks: '["React"]', title: "t" },
      });
      expect(prisma.projectTag.findMany).not.toHaveBeenCalled();
    });

    it("stacks가 바뀌면 빠진 태그 관계는 삭제하고 새 태그 관계만 추가한다", async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 1,
        stacks: '["React","Vue"]',
      });
      prisma.projectTag.findMany.mockResolvedValue([
        { id: 100, tag: { id: 10, name: "React" } },
        { id: 101, tag: { id: 12, name: "Vue" } },
      ]);
      prisma.tag.findUnique
        .mockResolvedValueOnce({ id: 10, name: "React" })
        .mockResolvedValueOnce(null);
      prisma.tag.create.mockResolvedValue({ id: 11, name: "NestJS" });

      await service.update("p1", { stacks: '["React","NestJS"]' } as never);

      expect(prisma.projectTag.findMany).toHaveBeenCalledWith({
        where: { projectId: 1 },
        include: { tag: true },
      });
      expect(prisma.projectTag.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [101] } },
      });
      expect(prisma.projectTag.create).toHaveBeenCalledTimes(1);
      expect(prisma.projectTag.create).toHaveBeenCalledWith({
        data: { projectId: 1, tagId: 11 },
      });
    });
  });

  describe("updateShow", () => {
    it("slug나 isShow 타입이 잘못되면 400 에러를 던진다", async () => {
      await expect(
        service.updateShow({ slug: "p1", isShow: "true" } as never),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it("노출 여부를 수정한다", async () => {
      await expect(
        service.updateShow({ slug: "p1", isShow: false }),
      ).resolves.toEqual({
        status: 200,
        message: "프로젝트 노출 상태 업데이트 success",
      });
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { slug: "p1" },
        data: { isShow: false },
      });
    });
  });

  describe("updateOrder", () => {
    it("두 프로젝트의 순서를 한 트랜잭션에서 바꾼다", async () => {
      await service.updateOrder({
        prevSlug: "a",
        prevOrderNo: 1,
        nextSlug: "b",
        nextOrderNo: 2,
      } as never);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.project.update).toHaveBeenNthCalledWith(1, {
        where: { slug: "b" },
        data: { order: 2 },
      });
      expect(prisma.project.update).toHaveBeenNthCalledWith(2, {
        where: { slug: "a" },
        data: { order: 1 },
      });
    });
  });

  describe("finedSearch", () => {
    beforeEach(() => {
      prisma.project.findMany.mockResolvedValue([{ id: 1 }]);
      prisma.project.count.mockResolvedValueOnce(1).mockResolvedValueOnce(30);
    });

    it("page, size가 없으면 1페이지 10개로 조회한다", async () => {
      const result = await service.finedSearch({} as never);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 10 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ allTotal: 30, page: 1, size: 10 }),
      );
    });

    it("filteredTotal에 검색 조건에 맞는 전체 개수를 담는다", async () => {
      const result = await service.finedSearch({ keyword: "nest" } as never);

      expect(prisma.project.count).toHaveBeenNthCalledWith(1, {
        where: expect.objectContaining({ OR: expect.any(Array) }),
      });
      expect(result).toEqual(
        expect.objectContaining({ total: 1, filteredTotal: 1, allTotal: 30 }),
      );
    });

    it("문자열 page, size를 숫자로 바꿔 skip을 계산한다", async () => {
      await service.finedSearch({ page: "3", size: "5" } as never);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it("keyword가 있으면 제목과 설명을 대소문자 구분 없이 검색한다", async () => {
      await service.finedSearch({ keyword: "nest" } as never);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              {
                title: {
                  contains: "nest",
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                description: {
                  contains: "nest",
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        }),
      );
    });
  });

  describe("remove", () => {
    it("slug로 프로젝트를 삭제한다", async () => {
      await expect(service.remove("p1")).resolves.toEqual({
        status: 200,
        message: "프로젝트 삭제 success",
      });
      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { slug: "p1" },
      });
    });
  });
});
