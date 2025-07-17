import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import {
  AdminProjectSearchRequest,
  AdminProjectSearchResponse,
} from "src/apps/admin/project/dto/project-search.dto";
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
  async finedSearch(params: AdminProjectSearchRequest) {
    const { keyword } = params;
    const page = Number(params.page) || 1;
    const size = Number(params.size) || 10;

    const where = keyword
      ? {
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
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: [{ order: "desc" }, { updatedAt: "desc" }],
      }),
      this.prisma.project.count({ where }),
    ]);
    return {
      data,
      total,
      page,
      size,
    } as AdminProjectSearchResponse;
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
}
