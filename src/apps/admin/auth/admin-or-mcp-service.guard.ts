import { ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "src/apps/public/auth/auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

// 관리자 JWT 또는 MCP 서버의 서비스 토큰을 인증 수단으로 받는다.
// 인증만 제공하며 어떤 경로를 열지는 이 가드를 쓰는 컨트롤러가 정한다.
@Injectable()
export class AdminOrMcpServiceGuard extends JwtAuthGuard {
  constructor(private readonly authService: AuthService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme === "Bearer" && this.isMcpServiceToken(token)) return true;
    return super.canActivate(context);
  }

  private isMcpServiceToken(token: string | undefined): boolean {
    try {
      this.authService.validateServiceToken("mcp", token);
      return true;
    } catch {
      // 서비스 토큰이 아니면 관리자 JWT로 다시 검증한다
      return false;
    }
  }
}
