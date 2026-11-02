import { Module } from "@nestjs/common";
import { AuthModule } from "src/apps/public/auth/auth.module";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminResumeModelSettingController } from "./resume-model-setting.controller";
import { AdminResumeModelSettingService } from "./resume-model-setting.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminResumeModelSettingController],
  providers: [AdminResumeModelSettingService, PrismaService],
})
export class AdminResumeModelSettingModule {}
