import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthServiceTokenGuard implements CanActivate {
  constructor(private readonly service: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientId = (request.body as { client_id?: string } | undefined)
      ?.client_id;
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (clientId !== "portfolio" && clientId !== "mcp") {
      this.service.validateServiceToken("mcp", undefined);
      return false;
    }
    if (scheme !== "Bearer") {
      this.service.validateServiceToken(clientId, undefined);
    }
    this.service.validateServiceToken(clientId, token);
    return true;
  }
}
