import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import {
  AdminTagCreateRequest,
  AdminTagUpdateRequest,
  AdminTagSearchRequest,
  AdminTagSearchResponse,
} from "./dto";

@Injectable()
export class AdminTagService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: AdminTagCreateRequest) {
    return this.prisma.tag.create({ data });
  }

  async findAll() {
    return this.prisma.tag.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async findSearch(params: AdminTagSearchRequest) {
    const { keyword } = params;
    const page = Number(params.page) || 1;
    const size = Number(params.size) || 10;

    const where = keyword
      ? {
          name: { contains: keyword, mode: Prisma.QueryMode.insensitive },
        }
      : {};

    const [data, , allTotal] = await this.prisma.$transaction([
      this.prisma.tag.findMany({
        where,
        skip: (page - 1) * size,
        take: size,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.tag.count({ where }),
      this.prisma.tag.count({}),
    ]);

    return {
      data,
      total: data.length,
      allTotal,
      page,
      size,
    } as AdminTagSearchResponse;
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
