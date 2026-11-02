import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

// 본문이 없는 GET·DELETE도 보호하려고 body.client_id가 아니라 Authorization 헤더만 본다
@Injectable()
export class McpServiceTokenGuard implements CanActivate {
  constructor(private readonly service: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    this.service.validateServiceToken(
      "mcp",
      scheme === "Bearer" ? token : undefined,
    );
    return true;
  }
}
