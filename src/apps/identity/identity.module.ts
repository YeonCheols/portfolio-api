import { Module } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { OAuthStateService } from "./oauth-state.service";
import { UserIdentityService } from "./user-identity.service";

@Module({
  providers: [UserIdentityService, OAuthStateService, PrismaService],
  exports: [UserIdentityService, OAuthStateService],
})
export class IdentityModule {}
