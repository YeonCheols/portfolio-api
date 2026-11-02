import { Module } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AdminResumeModelSettingController } from "./resume-model-setting.controller";
import { AdminResumeModelSettingService } from "./resume-model-setting.service";

@Module({
  controllers: [AdminResumeModelSettingController],
  providers: [AdminResumeModelSettingService, PrismaService],
})
export class AdminResumeModelSettingModule {}
