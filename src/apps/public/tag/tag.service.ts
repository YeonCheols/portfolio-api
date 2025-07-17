import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { TagSearchRequest, TagSearchResponse } from "./dto";

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async findSearch(params: TagSearchRequest) {
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
    } as TagSearchResponse;
  }
}
