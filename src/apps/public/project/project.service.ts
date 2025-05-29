import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

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
          id: "desc",
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
      where: {
        slug,
        isShow: true,
      },
    });
    return project;
  }
}
