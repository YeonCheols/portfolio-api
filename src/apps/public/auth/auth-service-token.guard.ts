import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthServiceTokenGuard implements CanActivate {
  constructor(private readonly service: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientId = (request.body as { client_id?: string } | undefined)
      ?.client_id;
    const match = /^Bearer ([^\s]+)$/.exec(request.headers.authorization ?? "");
    if (!match || (clientId !== "portfolio" && clientId !== "mcp"))
      throw new UnauthorizedException();
    if (clientId === "mcp") {
      this.service.validateServiceToken("mcp", match[1]);
    } else {
      await this.service.validateOAuthServiceToken(match[1], "auth:manage");
    }
    return true;
  }
}
