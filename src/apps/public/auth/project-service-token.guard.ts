import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class ProjectServiceTokenGuard implements CanActivate {
  constructor(private readonly service: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { authorization } = context
      .switchToHttp()
      .getRequest<Request>().headers;
    const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? "");
    if (!match) throw new UnauthorizedException();
    await this.service.validateProjectServiceToken(match[1]);
    return true;
  }
}
