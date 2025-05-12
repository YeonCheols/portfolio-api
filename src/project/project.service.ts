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

  async findOne(slug: string) {
    const user = await this.prisma.projects.findUnique({
      where: { slug },
    });
    console.log("user : ", user);
    return user;
  }

  async updateShow(slug: string, is_show: boolean) {
    const user = await this.prisma.projects.update({
      where: { slug },
      data: { is_show },
    });
    return user;
  }

  async update(slug: string, data: UpdateProjectDto) {
    const user = await this.prisma.projects.update({
      where: { slug },
      data,
    });
    return user;
  }

  async remove(slug: string) {
    const user = await this.prisma.projects.delete({
      where: { slug },
    });
    return user;
  }
}
