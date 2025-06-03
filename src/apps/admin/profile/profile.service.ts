import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminProfileCreateRequest, AdminProfileOrderUpdateRequest, AdminProfileUpdateRequest } from "./dto";

@Injectable()
export class AdminProfileService {
  constructor(private prisma: PrismaService) {}

  async create(data: AdminProfileCreateRequest) {
    const project = await this.prisma.profile.create({ data });
    return project;
  }

  async findAll() {
    const profileList = await this.prisma.profile.findMany({
      orderBy: [
        {
          id: "desc",
        },
        {
          order: "desc",
        },
      ],
    });
    return profileList;
  }

  async findOne(id: number) {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
    });
    return profile;
  }

  async update(id: number, data: AdminProfileUpdateRequest) {
    const profile = await this.prisma.profile.update({
      where: { id },
      data,
    });
    return profile;
  }

  async updateOrder(id: number, data: AdminProfileOrderUpdateRequest) {
    await this.prisma.profile.update({
      where: { id },
      data,
    });
  }
}
