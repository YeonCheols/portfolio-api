import { Module } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaService } from "src/prisma/prisma.service";
import { APP_FILTER } from "@nestjs/core";
import { AuthExceptionFilter } from "./auth.exception.filter";

@Module({
  providers: [
    JwtStrategy,
    PrismaService,
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    },
  ],
  exports: [JwtStrategy],
})
export class AdminAuthModule {}
