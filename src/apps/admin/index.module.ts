import { Module } from "@nestjs/common";
import { AdminProfileModule } from "./profile/profile.module";
import { AdminProjectModule } from "./project/project.module";
import { AdminUserModule } from "./user/user.module";
import { AdminAuthModule } from "./auth/auth.module";

@Module({
  imports: [
    AdminProfileModule,
    AdminProjectModule,
    AdminUserModule,
    AdminAuthModule,
  ],
})
export class AdminModule {}
