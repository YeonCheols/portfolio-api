import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { ResumeModelEnvironment } from "@prisma/client";
import { ResumeModelSettingActiveResponse } from "./dto";
import { ResumeModelSettingTokenGuard } from "./resume-model-setting-token.guard";
import { ResumeModelSettingService } from "./resume-model-setting.service";

@Controller("resume-model-setting")
export class ResumeModelSettingController {
  constructor(private readonly service: ResumeModelSettingService) {}

  @ApiOperation({
    summary: "환경의 활성 이력서 모델 설정 조회 (MCP 조회 전용 토큰)",
  })
  @ApiQuery({ name: "environment", enum: ResumeModelEnvironment })
  @ApiOkResponse({ type: ResumeModelSettingActiveResponse })
  @UseGuards(ResumeModelSettingTokenGuard)
  @Get("active")
  findActive(@Query("environment") environment: unknown) {
    return this.service.findActive(environment);
  }
}
