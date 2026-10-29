import { Module } from "@nestjs/common";
import { AdminProfileModule } from "./profile/profile.module";
import { AdminProjectModule } from "./project/project.module";
import { AdminUserModule } from "./user/user.module";
import { AdminAuthModule } from "./auth/auth.module";
import { AdminTagModule } from "./tag/tag.module";
import { AdminResumeModelSettingModule } from "./resume-model-setting/resume-model-setting.module";

@Module({
  imports: [
    AdminProfileModule,
    AdminProjectModule,
    AdminUserModule,
    AdminAuthModule,
    AdminTagModule,
    AdminResumeModelSettingModule,
  ],
})
export class AdminModule {}
