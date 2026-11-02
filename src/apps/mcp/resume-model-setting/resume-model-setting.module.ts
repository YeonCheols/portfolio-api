import { Module } from "@nestjs/common";
import { AdminResumeModelSettingService } from "src/apps/admin/resume-model-setting/resume-model-setting.service";
import { AuthModule } from "src/apps/public/auth/auth.module";
import { PrismaService } from "src/prisma/prisma.service";
import { McpResumeModelSettingController } from "./mcp-resume-model-setting.controller";

@Module({
  imports: [AuthModule],
  controllers: [McpResumeModelSettingController],
  providers: [AdminResumeModelSettingService, PrismaService],
})
export class McpResumeModelSettingModule {}
