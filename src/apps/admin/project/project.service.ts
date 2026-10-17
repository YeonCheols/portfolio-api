import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { Prisma, Tag } from "@prisma/client";
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

  private parseStacks(stacks: string): string[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stacks);
    } catch {
      throw new BadRequestException("stacks는 JSON 문자열 배열이어야 합니다");
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === "string")
    ) {
      throw new BadRequestException("stacks는 JSON 문자열 배열이어야 합니다");
    }
    return parsed;
  }

  private async findOrCreateTag(tx: Prisma.TransactionClient, name: string) {
    const tag = await tx.tag.findUnique({ where: { name } });
    if (tag) return tag;
    return tx.tag.create({
      data: {
        name,
        icon: "default-icon",
        color: "#000000",
        category: "technology",
      },
    });
  }

  // NOTE: stacks를 기반으로 태그를 생성하거나 찾고 ProjectTag 관계를 설정하는 메서드
  private async linkProjectTags(
    tx: Prisma.TransactionClient,
    projectId: number,
    stackNames: string[],
  ) {
    for (const stackName of stackNames) {
      const tag = await this.findOrCreateTag(tx, stackName);

      const existingRelation = await tx.projectTag.findUnique({
        where: { projectId_tagId: { projectId, tagId: tag.id } },
      });
      if (!existingRelation) {
        await tx.projectTag.create({ data: { projectId, tagId: tag.id } });
      }
    }
  }

  // NOTE: 기존 관계는 유지하고 빠진 태그 관계는 삭제, 새 태그 관계만 추가
  private async syncProjectTags(
    tx: Prisma.TransactionClient,
    projectId: number,
    stackNames: string[],
  ) {
    const existingProjectTags = await tx.projectTag.findMany({
      where: { projectId },
      include: { tag: true },
    });

    const newTags: Tag[] = [];
    for (const stackName of stackNames) {
      newTags.push(await this.findOrCreateTag(tx, stackName));
    }

    const existingTagNames = existingProjectTags.map((pt) => pt.tag.name);
    const newTagNames = newTags.map((tag) => tag.name);

    const tagsToRemove = existingProjectTags.filter(
      (pt) => !newTagNames.includes(pt.tag.name),
    );
    const tagsToAdd = newTags.filter(
      (tag) => !existingTagNames.includes(tag.name),
    );

    if (tagsToRemove.length > 0) {
      await tx.projectTag.deleteMany({
        where: { id: { in: tagsToRemove.map((pt) => pt.id) } },
      });
    }
    for (const tag of tagsToAdd) {
      await tx.projectTag.create({ data: { projectId, tagId: tag.id } });
    }
  }

  async create(data: AdminProjectCreateRequest) {
    const stackNames = this.parseStacks(data.stacks);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data });
      await this.linkProjectTags(tx, project.id, stackNames);
      return project;
    });
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
    // 기존 프로젝트 정보 조회
    const existingProject = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (!existingProject) {
      throw new NotFoundException("Project not found");
    }

    const stackNames =
      data.stacks && data.stacks !== existingProject.stacks
        ? this.parseStacks(data.stacks)
        : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { slug }, data });
      if (stackNames) {
        await this.syncProjectTags(tx, existingProject.id, stackNames);
      }
    });

    return {
      status: 200,
      message: "프로젝트 업데이트 success",
    };
  }

  async updateShow(data: AdminProjectStatusUpdateRequest) {
    if (typeof data.slug !== "string" || typeof data.isShow !== "boolean") {
      throw new BadRequestException("Invalid data types for slug or isShow");
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
    const [data, filteredTotal, allTotal] = await this.prisma.$transaction([
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
      total: data.length,
      filteredTotal,
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
