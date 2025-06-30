import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminTagCreateRequest, AdminTagUpdateRequest } from "./dto";

@Injectable()
export class AdminTagService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: AdminTagCreateRequest) {
    return this.prisma.tag.create({ data });
  }

  async findAll() {
    return this.prisma.tag.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async findOne(name: string) {
    const tag = await this.prisma.tag.findUnique({ where: { name } });
    if (!tag) throw new NotFoundException("Tag not found");
    return tag;
  }

  async update(name: string, data: AdminTagUpdateRequest) {
    return this.prisma.tag.update({ where: { name }, data });
  }

  async remove(name: string) {
    return this.prisma.tag.delete({ where: { name } });
  }
}
