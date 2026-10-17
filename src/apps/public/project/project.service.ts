import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { ProjectSearchRequest, ProjectSearchResponse } from "./dto";
import { TagCategoryEnum } from "src/enum/category";
@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const projectList = await this.prisma.project.findMany({
      where: {
        isShow: true,
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

    return projectList;
  }

  // 프로젝트 검색
  async finedSearch(params: ProjectSearchRequest) {
    const { keyword } = params;
    const page = Number(params.page) || 1;
    const size = Number(params.size) || 10;

    const where = keyword
      ? {
          isShow: true,
          OR: [
            {
              title: { contains: keyword, mode: Prisma.QueryMode.insensitive },
            },
            {
              description: {
                contains: keyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {
          isShow: true,
        };
    const [data, filteredTotal, allTotal] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: [{ order: "desc" }, { updatedAt: "desc" }],
      }),
      this.prisma.project.count({ where }),
      this.prisma.project.count({ where: { isShow: true } }),
    ]);
    return {
      data,
      total: data.length,
      filteredTotal,
      allTotal,
      page,
      size,
    } as ProjectSearchResponse;
  }

  async findOne(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: {
        slug,
        isShow: true,
      },
    });
    return project;
  }

  // stacks를 기반으로 Tags를 검색하는 메서드
  async findTagsByStacks(stacks: string): Promise<any[]> {
    try {
      // stacks 문자열을 JSON 배열로 파싱
      const stackArray = JSON.parse(stacks) as string[];

      // 해당하는 태그들을 찾기
      const tags = await this.prisma.tag.findMany({
        where: {
          name: {
            in: stackArray,
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      return tags;
    } catch {
      // 에러 발생 시 빈 배열 반환
      return [];
    }
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

    return projects.map((project) => ({
      ...project,
      projectTags: (project.projectTags || []).map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        icon: pt.tag.icon,
        color: pt.tag.color,
        category: pt.tag.category as TagCategoryEnum,
        updatedAt: pt.tag.updatedAt,
      })),
    }));
  }

  // 여러 태그를 사용하는 프로젝트들을 찾는 메서드
  async findProjectsByTags(tagNames: string[]) {
    const projects = await this.prisma.project.findMany({
      where: {
        isShow: true,
        projectTags: {
          some: {
            tag: {
              name: {
                in: tagNames,
              },
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

    return projects.map((project) => ({
      ...project,
      projectTags: (project.projectTags || []).map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        icon: pt.tag.icon,
        color: pt.tag.color,
        category: pt.tag.category as TagCategoryEnum,
        updatedAt: pt.tag.updatedAt,
      })),
    }));
  }
}
