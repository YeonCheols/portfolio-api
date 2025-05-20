import { Injectable } from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { StatusUpdateDto } from "./dto/show-project.dto";
@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateProjectDto) {
    const project = await this.prisma.projects.create({ data });
    return project;
  }

  async findAll() {
    const projectList = await this.prisma.projects.findMany({
      orderBy: [
        {
          id: "desc",
        },
        {
          updated_at: "desc",
        },
      ],
    });
    return projectList;
  }

  async findOne(slug: string) {
    const project = await this.prisma.projects.findUnique({
      where: { slug },
    });
    return project;
  }

  async findOverSlug(slug: string) {
    const count = await this.prisma.projects.count({
      where: { slug },
    });
    return count;
  }

  async updateShow(data: StatusUpdateDto) {
    if (typeof data.slug !== "string" || typeof data.is_show !== "boolean") {
      throw new Error("Invalid data types for slug or is_show");
    }
    await this.prisma.projects.update({
      where: { slug: data.slug },
      data: { is_show: data.is_show },
    });
    return {
      status: 200,
      message: "프로젝트 노출 상태 업데이트 success",
    };
  }

  async update(slug: string, data: UpdateProjectDto) {
    await this.prisma.projects.update({
      where: { slug },
      data,
    });
    return {
      status: 200,
      message: "프로젝트 업데이트 success",
    };
  }

  async remove(slug: string) {
    await this.prisma.projects.delete({
      where: { slug },
    });
    return {
      status: 200,
      message: "프로젝트 삭제 success",
    };
  }
}
