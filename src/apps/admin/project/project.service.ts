import { Injectable } from "@nestjs/common";
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

  // NOTE: stacks를 기반으로 태그를 생성하거나 찾고 ProjectTag 관계를 설정하는 메서드
  private async createOrUpdateProjectTags(projectId: number, stacks: string) {
    try {
      // stacks JSON 파싱
      const stackArray = JSON.parse(stacks) as string[];

      for (const stackName of stackArray) {
        // 태그가 존재하는지 확인
        let tag = await this.prisma.tag.findUnique({
          where: { name: stackName },
        });

        // 태그가 없으면 생성
        if (!tag) {
          tag = await this.prisma.tag.create({
            data: {
              name: stackName,
              icon: "default-icon", // 기본값
              color: "#000000", // 기본값
              category: "technology", // 기본값
            },
          });
        }

        // ProjectTag 관계 생성 (중복 방지)
        const existingRelation = await this.prisma.projectTag.findUnique({
          where: {
            projectId_tagId: {
              projectId: projectId,
              tagId: tag.id,
            },
          },
        });

        if (!existingRelation) {
          await this.prisma.projectTag.create({
            data: {
              projectId: projectId,
              tagId: tag.id,
            },
          });
        }
      }
    } catch (error) {
      console.warn("Error creating/updating project tags:", error);
    }
  }

  // NOTE: 프로젝트 태그 관계를 효율적으로 업데이트하는 메서드
  private async updateProjectTagsEfficiently(
    projectId: number,
    newStacks: string,
  ) {
    try {
      // 새로운 stacks JSON 파싱
      const newStackArray = JSON.parse(newStacks) as string[];

      // 기존 프로젝트 태그 관계 조회
      const existingProjectTags = await this.prisma.projectTag.findMany({
        where: { projectId },
        include: { tag: true },
      });

      // 새로운 태그들을 찾거나 생성
      const newTags: Tag[] = [];
      for (const stackName of newStackArray) {
        let tag = await this.prisma.tag.findUnique({
          where: { name: stackName },
        });

        if (!tag) {
          tag = await this.prisma.tag.create({
            data: {
              name: stackName,
              icon: "default-icon",
              color: "#000000",
              category: "technology",
            },
          });
        }
        newTags.push(tag);
      }

      // 기존 태그 이름들과 새로운 태그 이름들
      const existingTagNames = existingProjectTags.map((pt) => pt.tag.name);
      const newTagNames = newTags.map((tag) => tag.name);

      // 제거할 태그들 (기존에 있지만 새로운 stacks에 없는 태그들)
      const tagsToRemove = existingProjectTags.filter(
        (pt) => !newTagNames.includes(pt.tag.name),
      );

      // 추가할 태그들 (새로운 stacks에 있지만 기존에 없는 태그들)
      const tagsToAdd = newTags.filter(
        (tag) => !existingTagNames.includes(tag.name),
      );

      // 제거할 태그 관계 삭제
      if (tagsToRemove.length > 0) {
        await this.prisma.projectTag.deleteMany({
          where: {
            id: {
              in: tagsToRemove.map((pt) => pt.id),
            },
          },
        });
      }

      // 추가할 태그 관계 생성
      for (const tag of tagsToAdd) {
        await this.prisma.projectTag.create({
          data: {
            projectId: projectId,
            tagId: tag.id,
          },
        });
      }
    } catch (error) {
      console.warn("Error updating project tags efficiently:", error);
    }
  }

  async create(data: AdminProjectCreateRequest) {
    const project = await this.prisma.project.create({ data });

    // 프로젝트 생성 후 태그 관계 설정
    await this.createOrUpdateProjectTags(project.id, data.stacks);

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
    // 기존 프로젝트 정보 조회
    const existingProject = await this.prisma.project.findUnique({
      where: { slug },
    });

    if (!existingProject) {
      throw new Error("Project not found");
    }

    // 프로젝트 업데이트
    await this.prisma.project.update({
      where: { slug },
      data,
    });

    // stacks가 업데이트된 경우에만 태그 관계 재설정
    if (data.stacks && data.stacks !== existingProject.stacks) {
      // 효율적인 태그 관계 업데이트 (기존 관계 유지, 추가/제거만 처리)
      await this.updateProjectTagsEfficiently(existingProject.id, data.stacks);
    }

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
    const [data, , allTotal] = await this.prisma.$transaction([
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
