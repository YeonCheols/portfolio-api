import { Module } from "@nestjs/common";
import { AdminProjectController } from "./project/project.controller";
import { AdminProjectService } from "./project/project.service";
import { AdminProfileController } from "./profile/profile.controller";
import { AdminProfileService } from "./profile/profile.service";

@Module({
  controllers: [AdminProjectController, AdminProfileController],
  providers: [AdminProjectService, AdminProfileService],
})
export class AdminModule {}
