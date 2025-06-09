import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { PrismaClient } from "@prisma/client";
import {
  AdminProfileCreateRequest,
  AdminProfileOrderUpdateRequest,
  AdminProfileStatusUpdateRequest,
  AdminProfileUpdateRequest,
} from "./dto";
@Injectable()
export class AdminProfileService {
  constructor(private prisma: PrismaService) {}

  // NOTE: 프로필 활성화 개수가 1개 이상이면 롤백함
  async activeCount(
    prisma: Pick<PrismaClient, "profile">,
    isActiveRequest: boolean,
    id?: number,
  ) {
    if (isActiveRequest) {
      const count = await prisma.profile.count({
        where: { isActive: true, ...(id && { id: { not: id } }) },
      });
      if (count > 0) {
        throw new HttpException(
          "이미 활성화된 프로필이 존재합니다. 프로필은 1개만 활성화 할 수 있습니다.",
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async create(data: AdminProfileCreateRequest) {
    return this.prisma.$transaction(async (prisma) => {
      await this.activeCount(prisma, data.isActive ?? false);
      const profile = await prisma.profile.create({ data });
      return {
        status: 200,
        message: "프로필 생성 success",
        data: profile,
      };
    });
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
      where: { id: Number(id) },
    });
    return profile;
  }

  async update(id: number, data: AdminProfileUpdateRequest) {
    return this.prisma.$transaction(async (prisma) => {
      await this.activeCount(prisma, data.isActive ?? false, Number(id));
      const profile = await prisma.profile.update({
        where: { id: Number(id) },
        data,
      });
      return {
        status: 200,
        message: "프로필 수정 success",
        data: profile,
      };
    });
  }

  async updateStatus(id: number, data: AdminProfileStatusUpdateRequest) {
    const profileId = Number(id);

    return this.prisma.$transaction(async (prisma) => {
      await this.activeCount(prisma, data.isActive ?? false, Number(id));
      await prisma.profile.update({
        where: { id: profileId },
        data,
      });
      return {
        status: 200,
        message: "상태 업데이트 success",
      };
    });
  }

  async updateOrder(data: AdminProfileOrderUpdateRequest) {
    const profileId = Number(data.id);

    await this.prisma.profile.update({
      where: { id: profileId },
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
