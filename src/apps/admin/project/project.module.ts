import { Module } from "@nestjs/common";
import { AdminProjectController } from "./project.controller";
import { AdminProjectService } from "./project.service";

@Module({
  controllers: [AdminProjectController],
  providers: [AdminProjectService],
})
export class AdminProjectModule {}
