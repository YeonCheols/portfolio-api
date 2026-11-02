import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import {
  AdminResumeModelSettingCreateRequest,
  AdminResumeModelSettingResponse,
  AdminResumeModelSettingUpdateRequest,
} from "src/apps/admin/resume-model-setting/dto";
import { AdminResumeModelSettingService } from "src/apps/admin/resume-model-setting/resume-model-setting.service";
import { McpServiceTokenGuard } from "src/apps/public/auth/mcp-service-token.guard";

// 설정 데이터와 저장소는 portfolio-api가 소유하고, 관리 경로와 화면은 MCP 서버가 소유한다.
// 이 컨트롤러는 MCP 서버가 서비스 토큰으로 호출하는 저장소 접근 면이다.
@ApiBearerAuth()
@UseGuards(McpServiceTokenGuard)
@Controller("service/resume-model-setting")
export class McpResumeModelSettingController {
  constructor(private readonly service: AdminResumeModelSettingService) {}

  @ApiOperation({ summary: "이력서 모델 설정 목록 (서비스 토큰)" })
  @ApiOkResponse({ type: [AdminResumeModelSettingResponse] })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: "이력서 모델 설정 생성 (비활성 상태, 서비스 토큰)" })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @Post()
  create(@Body() body: AdminResumeModelSettingCreateRequest) {
    return this.service.create(body);
  }

  @ApiOperation({
    summary: "비활성 이력서 모델 설정 수정 (환경은 유지, 서비스 토큰)",
  })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: AdminResumeModelSettingUpdateRequest,
  ) {
    return this.service.update(id, body);
  }

  @ApiOperation({
    summary:
      "이력서 모델 설정 활성화 (같은 환경의 기존 활성은 해제, 서비스 토큰)",
  })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @HttpCode(HttpStatus.OK)
  @Post(":id/activate")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.service.activate(id);
  }

  @ApiOperation({ summary: "비활성 이력서 모델 설정 삭제 (서비스 토큰)" })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
