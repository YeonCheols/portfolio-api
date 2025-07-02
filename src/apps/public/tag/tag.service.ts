import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.tag.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async findSearch(keyword: string) {
    if (!keyword) {
      throw new BadRequestException("Keyword is required");
    }
    return this.prisma.tag.findMany({
      where: {
        name: { contains: keyword, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
    });
  }
}
