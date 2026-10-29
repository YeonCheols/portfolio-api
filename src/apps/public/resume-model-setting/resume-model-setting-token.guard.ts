import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "crypto";
import { Request } from "express";

const digest = (value: string) => createHash("sha256").update(value).digest();

// MCP만 활성 모델 설정을 읽도록 관리자 JWT와 분리한 조회 전용 토큰을 검사한다
@Injectable()
export class ResumeModelSettingTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const serverToken = process.env.RESUME_MODEL_SETTING_TOKEN;
    // 서버 토큰이 없으면 빈 Bearer와 일치하지 않도록 모든 요청을 거부한다
    if (!serverToken?.trim()) {
      throw new UnauthorizedException();
    }

    const { authorization } = context
      .switchToHttp()
      .getRequest<Request>().headers;
    const [scheme, token] = authorization?.split(" ") ?? [];
    // 길이가 다른 값도 같은 시간에 비교되도록 다이제스트끼리 비교한다
    if (
      scheme !== "Bearer" ||
      !token ||
      !timingSafeEqual(digest(token), digest(serverToken))
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
