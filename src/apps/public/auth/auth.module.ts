import { Module } from "@nestjs/common";
import { IdentityModule } from "src/apps/identity/identity.module";
import { PrismaService } from "src/prisma/prisma.service";
import { AuthController } from "./auth.controller";
import { AuthServiceTokenGuard } from "./auth-service-token.guard";
import { AuthService } from "./auth.service";
import { GitHubActionsOidcService } from "./github-actions-oidc.service";
import { OAuthMetadataController } from "./oauth-metadata.controller";

@Module({
  imports: [IdentityModule],
  controllers: [AuthController, OAuthMetadataController],
  providers: [
    GitHubActionsOidcService,
    AuthService,
    AuthServiceTokenGuard,
    PrismaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
