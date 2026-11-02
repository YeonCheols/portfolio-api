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
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { AdminAuthController } from "../auth/auth.controller";
import {
  AdminResumeModelSettingCreateRequest,
  AdminResumeModelSettingResponse,
  AdminResumeModelSettingUpdateRequest,
} from "./dto";
import { AdminResumeModelSettingService } from "./resume-model-setting.service";

@ApiBearerAuth("access-token")
@Controller("admin/resume-model-setting")
export class AdminResumeModelSettingController extends AdminAuthController {
  constructor(private readonly service: AdminResumeModelSettingService) {
    super();
  }

  @ApiOperation({ summary: "이력서 모델 설정 목록" })
  @ApiOkResponse({ type: [AdminResumeModelSettingResponse] })
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: "이력서 모델 설정 생성 (비활성 상태)" })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @Post()
  create(@Body() body: AdminResumeModelSettingCreateRequest) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: "비활성 이력서 모델 설정 수정 (환경은 유지)" })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: AdminResumeModelSettingUpdateRequest,
  ) {
    return this.service.update(id, body);
  }

  @ApiOperation({
    summary: "이력서 모델 설정 활성화 (같은 환경의 기존 활성은 해제)",
  })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @HttpCode(HttpStatus.OK)
  @Post(":id/activate")
  activate(@Param("id", ParseIntPipe) id: number) {
    return this.service.activate(id);
  }

  @ApiOperation({ summary: "비활성 이력서 모델 설정 삭제" })
  @ApiOkResponse({ type: AdminResumeModelSettingResponse })
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
