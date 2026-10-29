import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { parseResumeModelSettingInput } from "./resume-model-setting.policy";

@Injectable()
export class AdminResumeModelSettingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(body: unknown) {
    return this.prisma.resumeModelSetting.create({
      data: { ...parseResumeModelSettingInput(body), isActive: false },
    });
  }

  async findAll() {
    return this.prisma.resumeModelSetting.findMany({
      orderBy: [{ environment: "asc" }, { updatedAt: "desc" }],
    });
  }

  async update(id: number, body: unknown) {
    const current = await this.findOrThrow(id);
    // MCP가 지금 읽는 설정을 바꾸지 않도록 새 설정을 만들어 활성화하게 한다
    if (current.isActive) {
      throw new BadRequestException("활성 모델 설정은 수정할 수 없습니다.");
    }
    // 환경을 바꾸면 다른 환경의 활성 규칙을 거치지 않으므로 기존 환경을 유지한다
    const data = parseResumeModelSettingInput({
      ...(body as object),
      environment: current.environment,
    });
    return this.prisma.resumeModelSetting.update({ where: { id }, data });
  }

  async activate(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const target = await this.findOrThrow(id, tx);
      // 부분 유니크 인덱스가 같은 환경의 활성 두 개를 거부하므로 기존 활성을 먼저 끈다
      await tx.resumeModelSetting.updateMany({
        where: {
          environment: target.environment,
          isActive: true,
          NOT: { id },
        },
        data: { isActive: false },
      });
      return tx.resumeModelSetting.update({
        where: { id },
        data: { isActive: true },
      });
    });
  }

  async remove(id: number) {
    const current = await this.findOrThrow(id);
    if (current.isActive) {
      throw new BadRequestException(
        "활성 모델 설정은 삭제할 수 없습니다. 다른 설정을 먼저 활성화합니다.",
      );
    }
    // 확인과 삭제 사이에 활성화되면 조건이 맞지 않아 삭제되지 않는다
    return this.prisma.resumeModelSetting.delete({
      where: { id, isActive: false },
    });
  }

  private async findOrThrow(
    id: number,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const setting = await client.resumeModelSetting.findUnique({
      where: { id },
    });
    if (!setting) {
      throw new NotFoundException("모델 설정을 찾을 수 없습니다.");
    }
    return setting;
  }
}
