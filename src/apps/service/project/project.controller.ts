import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Put,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { AdminProjectService } from "src/apps/admin/project/project.service";
import { ProjectServiceTokenGuard } from "src/apps/public/auth/project-service-token.guard";
import { withProjectRecency } from "src/apps/public/project/project-recency";
import {
  ServiceProjectUpsertRequest,
  ServiceProjectUpsertResponse,
} from "./dto";

@ApiTags("Project service")
@ApiBearerAuth()
@UseGuards(ProjectServiceTokenGuard)
@Controller("service/project")
export class ServiceProjectController {
  constructor(private readonly service: AdminProjectService) {}

  @Put()
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "slug 기준 공개 프로젝트 생성·업데이트 (공통 OAuth 서비스 권한)",
  })
  @ApiOkResponse({ type: ServiceProjectUpsertResponse })
  async upsert(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        exceptionFactory: () =>
          new BadRequestException("프로젝트 입력이 올바르지 않습니다."),
      }),
    )
    body: ServiceProjectUpsertRequest,
  ) {
    const result = await this.service.upsert(body);
    return { ...result, project: withProjectRecency(result.project) };
  }
}
