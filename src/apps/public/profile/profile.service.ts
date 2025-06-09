import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async findOne() {
    const profile = await this.prisma.profile.findFirst({
      where: { isActive: true },
      orderBy: [{ order: "desc" }],
    });
    return profile;
  }
}
