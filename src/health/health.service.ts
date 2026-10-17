import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

// Vercel 함수 제한 시간보다 먼저 503으로 응답하기 위한 상한
export const DB_CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  check() {
    return { status: "ok" as const };
  }

  async checkDb() {
    const startedAt = Date.now();
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`DB check timed out (${DB_CHECK_TIMEOUT_MS}ms)`),
              ),
            DB_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      this.logger.error(`DB health check 실패: ${(error as Error).message}`);
      // 연결 정보가 담길 수 있으므로 원인은 응답에 포함하지 않는다
      throw new ServiceUnavailableException({ status: "error", db: "down" });
    } finally {
      clearTimeout(timer);
    }

    return {
      status: "ok" as const,
      db: "up" as const,
      latencyMs: Date.now() - startedAt,
    };
  }
}
