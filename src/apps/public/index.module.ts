import { Module } from "@nestjs/common";
import { ProfileModule } from "./profile/profile.module";
import { ProjectModule } from "./project/project.module";
import { TagModule } from "./tag/tag.module";
import { MailModule } from "./mail/mail.module";

@Module({
  imports: [ProjectModule, ProfileModule, TagModule, MailModule],
})
export class PublicModule {}
