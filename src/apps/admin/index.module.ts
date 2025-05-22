import { Module } from "@nestjs/common";
import { AdminProjectController } from "./project/project.controller";
import { AdminProjectService } from "./project/project.service";

@Module({
  controllers: [AdminProjectController],
  providers: [AdminProjectService],
})
export class AdminModule {}
