import { Module } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaService } from "src/prisma/prisma.service";
import { APP_FILTER } from "@nestjs/core";
import { AuthExceptionFilter } from "./auth.exception.filter";
import { IdentityModule } from "src/apps/identity/identity.module";
import { AdminOAuthController } from "./oauth/admin-oauth.controller";
import { AdminOAuthService } from "./oauth/admin-oauth.service";

@Module({
  imports: [IdentityModule],
  controllers: [AdminOAuthController],
  providers: [
    JwtStrategy,
    PrismaService,
    AdminOAuthService,
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    },
  ],
  exports: [JwtStrategy],
})
export class AdminAuthModule {}
