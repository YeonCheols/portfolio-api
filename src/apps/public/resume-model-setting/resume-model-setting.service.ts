import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ResumeModelEnvironment } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

const isEnvironment = (value: unknown): value is ResumeModelEnvironment =>
  Object.values<unknown>(ResumeModelEnvironment).includes(value);

@Injectable()
export class ResumeModelSettingService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(environment: unknown) {
    if (!isEnvironment(environment)) {
      throw new BadRequestException(
        `environment는 ${Object.values(ResumeModelEnvironment).join(", ")} 중 하나여야 합니다.`,
      );
    }
    const active = await this.prisma.resumeModelSetting.findFirst({
      where: { environment, isActive: true },
      // 토큰은 저장하지 않지만 MCP 계약 밖 필드도 응답에 섞이지 않게 DB 조회에서 제한한다
      select: { provider: true, modelName: true, url: true, secretRef: true },
    });
    // MCP가 엉뚱한 모델로 생성하지 않도록 다른 환경이나 기본값으로 대체하지 않는다
    if (!active) {
      throw new NotFoundException(
        `${environment} 환경의 활성 모델 설정이 없습니다.`,
      );
    }
    return active;
  }
}
