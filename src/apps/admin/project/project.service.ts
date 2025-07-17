import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Prisma } from "@prisma/client";
import {
  AdminProjectCreateRequest,
  AdminProjectUpdateRequest,
  AdminProjectStatusUpdateRequest,
  AdminProjectOrderUpdateRequest,
} from "./dto";
import {
  AdminProjectSearchRequest,
  AdminProjectSearchResponse,
} from "./dto/project-search.dto";

@Injectable()
export class AdminProjectService {
  constructor(private prisma: PrismaService) {}

  async create(data: AdminProjectCreateRequest) {
    const project = await this.prisma.project.create({ data });
    return project;
  }

  async findAll() {
    const projectList = await this.prisma.project.findMany({
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

  async findOne(slug: string) {
    const project = await this.prisma.project.findUnique({
      where: { slug },
    });
    return project;
  }

  async findOverSlug(slug: string) {
    const count = await this.prisma.project.count({
      where: { slug },
    });
    return count;
  }

  async update(slug: string, data: AdminProjectUpdateRequest) {
    await this.prisma.project.update({
      where: { slug },
      data,
    });
    return {
      status: 200,
      message: "프로젝트 업데이트 success",
    };
  }

  async updateShow(data: AdminProjectStatusUpdateRequest) {
    if (typeof data.slug !== "string" || typeof data.isShow !== "boolean") {
      throw new Error("Invalid data types for slug or isShow");
    }
    await this.prisma.project.update({
      where: { slug: data.slug },
      data: { isShow: data.isShow },
    });
    return {
      status: 200,
      message: "프로젝트 노출 상태 업데이트 success",
    };
  }

  async updateOrder(data: AdminProjectOrderUpdateRequest) {
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { slug: data.nextSlug },
        data: { order: data.nextOrderNo },
      });
      await tx.project.update({
        where: { slug: data.prevSlug },
        data: { order: data.prevOrderNo },
      });
    });

    return {
      status: 200,
      message: "프로젝트 순서 업데이트 success",
    };
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
    const [data, total, allTotal] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: [{ order: "desc" }, { updatedAt: "desc" }],
      }),
      this.prisma.project.count({ where }),
      this.prisma.project.count({}),
    ]);
    return {
      data,
      total,
      allTotal,
      page,
      size,
    } as AdminProjectSearchResponse;
  }

  async remove(slug: string) {
    await this.prisma.project.delete({
      where: { slug },
    });
    return {
      status: 200,
      message: "프로젝트 삭제 success",
    };
  }
}
