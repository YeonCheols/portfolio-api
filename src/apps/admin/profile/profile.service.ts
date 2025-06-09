import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import {
  AdminProfileCreateRequest,
  AdminProfileOrderUpdateRequest,
  AdminProfileStatusUpdateRequest,
  AdminProfileUpdateRequest,
} from "./dto";

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

  async updateStatus(id: number, data: AdminProfileStatusUpdateRequest) {
    await this.prisma.profile.update({
      where: { id },
      data,
    });
    return {
      status: 200,
      message: "상태 업데이트 success",
    };
  }

  async updateOrder(data: AdminProfileOrderUpdateRequest) {
    await this.prisma.profile.update({
      where: { id: data.id },
      data,
    });
    return {
      status: 200,
      message: "정렬 수정 success",
    };
  }

  async remove(id: number) {
    const profileId = Number(id);

    await this.prisma.profile.delete({
      where: { id: profileId },
    });
    return {
      status: 200,
      message: "프로필 삭제 success",
    };
  }
}
