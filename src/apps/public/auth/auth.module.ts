import { Module } from "@nestjs/common";
import { IdentityModule } from "src/apps/identity/identity.module";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthController } from "./auth.controller";
import { AuthServiceTokenGuard } from "./auth-service-token.guard";
import { AuthService } from "./auth.service";

@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
  providers: [AuthService, AuthServiceTokenGuard, PrismaService],
})
export class AuthModule {}
