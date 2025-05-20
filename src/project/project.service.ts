import { Injectable } from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { PrismaService } from "src/prisma/prisma.service";

const showFilter = {
  is_show: true,
};

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
      where: {
        ...showFilter,
      },
    });
    return projectList;
  }

  async findOne(slug: string) {
    const project = await this.prisma.projects.findUnique({
      where: { slug, ...showFilter },
    });
    return project;
  }

  async updateShow(slug: string, is_show: boolean) {
    const project = await this.prisma.projects.update({
      where: { slug },
      data: { is_show },
    });
    return project;
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
