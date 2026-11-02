import { Module } from "@nestjs/common";
import { McpResumeModelSettingModule } from "./resume-model-setting/resume-model-setting.module";

@Module({
  imports: [McpResumeModelSettingModule],
})
export class McpModule {}
