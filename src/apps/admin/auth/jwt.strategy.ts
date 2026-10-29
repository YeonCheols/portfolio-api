import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "src/prisma/prisma.service";
import { getAdminJwtSecret } from "./jwt-secret";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getAdminJwtSecret(),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    return user;
  }
}
