import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { TagResponse, TagSearchRequest, TagSearchResponse } from "./dto";

@Injectable()
export class TagService {
  private tagsCache: { data: TagResponse[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<TagResponse[]> {
    // NOTE: TTL 5분 이내 캐싱된 데이터 반환
    if (
      this.tagsCache &&
      Date.now() - this.tagsCache.timestamp < this.CACHE_TTL
    ) {
      return this.tagsCache.data;
    }

    const tags = await this.prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        category: true,
        updatedAt: true,
        _count: {
          select: {
            projectTags: {
              where: {
                project: {
                  isShow: true,
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // 캐시 업데이트
    this.tagsCache = {
      data: tags.map((tag) => {
        const { _count, ...rest } = tag;
        return {
          ...rest,
          projectCount: _count.projectTags,
        };
      }) as TagResponse[],
      timestamp: Date.now(),
    };

    return tags.map((tag) => {
      const { _count, ...rest } = tag;
      return {
        ...rest,
        projectCount: _count.projectTags,
      };
    }) as TagResponse[];
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

    const [data, filteredTotal, allTotal] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
          category: true,
          updatedAt: true,
          _count: {
            select: {
              projectTags: {
                where: {
                  project: {
                    isShow: true,
                  },
                },
              },
            },
          },
        },
        skip: (page - 1) * size,
        take: size,
        orderBy: { name: "asc" },
      }),
      this.prisma.tag.count({ where }),
      this.prisma.tag.count({}),
    ]);

    return {
      data: data.map((tag) => ({
        id: tag.id,
        name: tag.name,
        icon: tag.icon,
        color: tag.color,
        category: tag.category,
        updatedAt: tag.updatedAt,
        projectCount: tag._count.projectTags,
      })),
      total: data.length,
      filteredTotal,
      allTotal,
      page,
      size,
    } as TagSearchResponse;
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
      where: {
        projectTags: {
          some: {
            project: {
              isShow: true,
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return tagCounts.map((tag) => {
      const { _count, ...rest } = tag;
      return {
        ...rest,
        projectCount: _count.projectTags,
      };
    }) as TagResponse[];
  }
}
