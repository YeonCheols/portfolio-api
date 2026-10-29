import { Module } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { ResumeModelSettingController } from "./resume-model-setting.controller";
import { ResumeModelSettingService } from "./resume-model-setting.service";

@Module({
  controllers: [ResumeModelSettingController],
  providers: [ResumeModelSettingService, PrismaService],
})
export class ResumeModelSettingModule {}
