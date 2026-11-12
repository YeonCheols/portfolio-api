import { Module } from "@nestjs/common";
import { AdminProjectService } from "src/apps/admin/project/project.service";
import { AuthModule } from "src/apps/public/auth/auth.module";
import { ProjectServiceTokenGuard } from "src/apps/public/auth/project-service-token.guard";
import { ServiceProjectController } from "./project.controller";

@Module({
  imports: [AuthModule],
  controllers: [ServiceProjectController],
  providers: [AdminProjectService, ProjectServiceTokenGuard],
})
export class ServiceProjectModule {}
