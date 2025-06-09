import { Module } from "@nestjs/common";
import { ProfileModule } from "./profile/profile.module";
import { ProjectModule } from "./project/project.module";

@Module({
  imports: [ProjectModule, ProfileModule],
})
export class PublicModule {}
