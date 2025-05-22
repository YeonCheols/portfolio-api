import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const projectList = await this.prisma.projects.findMany({
      where: {
        is_show: true,
      },
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
      where: {
        slug,
        is_show: true,
      },
    });
    return project;
  }
}
