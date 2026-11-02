import { Module } from "@nestjs/common";
import { ProfileModule } from "./profile/profile.module";
import { ProjectModule } from "./project/project.module";
import { TagModule } from "./tag/tag.module";
import { MailModule } from "./mail/mail.module";
import { ResumeModelSettingModule } from "./resume-model-setting/resume-model-setting.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    ProjectModule,
    ProfileModule,
    TagModule,
    MailModule,
    ResumeModelSettingModule,
    AuthModule,
  ],
})
export class PublicModule {}
