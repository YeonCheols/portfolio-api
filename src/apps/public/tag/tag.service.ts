import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { TagSearchRequest, TagSearchResponse } from "./dto";

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async findSearch(params: TagSearchRequest) {
    const { keyword } = params;
    const page = Number(params.page) || 1;
    const size = Number(params.size) || 10;

    const where = keyword
      ? {
          name: { contains: keyword, mode: Prisma.QueryMode.insensitive },
        }
      : {};

    const [data, , allTotal] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.tag.count({ where }),
      this.prisma.tag.count({}),
    ]);

    return {
      data,
      total: data.length,
      allTotal,
      page,
      size,
    } as TagSearchResponse;
  }

  // 특정 태그를 사용하는 프로젝트들을 찾는 메서드
  async findProjectsByTag(tagName: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        isShow: true,
        projectTags: {
          some: {
            tag: {
              name: tagName,
            },
          },
        },
      },
      include: {
        projectTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: [
        {
          order: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    return projects;
  }

  // 태그별 프로젝트 개수 통계
  async getTagProjectCounts() {
    const tagCounts = await this.prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        category: true,
        _count: {
          select: {
            projectTags: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return tagCounts.map((tag) => ({
      ...tag,
      projectCount: tag._count.projectTags,
      _count: undefined,
    }));
  }
}
