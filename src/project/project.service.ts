import { Injectable } from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateProjectDto) {
    const user = await this.prisma.projects.create({ data });
    return user;
  }

  async findAll() {
    const userList = await this.prisma.projects.findMany();
    return userList;
  }

  async findOne(id: number) {
    const user = await this.prisma.projects.findUnique({
      where: { id },
    });
    return user;
  }

  async update(id: number, data: UpdateProjectDto) {
    const user = await this.prisma.projects.update({
      where: { id },
      data,
    });
    return user;
  }

  async remove(id: number) {
    const user = await this.prisma.projects.delete({
      where: { id },
    });
    return user;
  }
}
