import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Patch,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AdminProjectService } from "./project.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { StatusUpdateDto } from "./dto/show-project.dto";

@ApiTags("Admin Project")
@Controller("admin/project")
export class AdminProjectController {
  constructor(private readonly adminProjectService: AdminProjectService) {}

  @ApiOperation({ summary: "프로젝트 생성" })
  @ApiResponse({ status: 201, description: "프로젝트가 성공적으로 생성됨" })
  @Post()
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.adminProjectService.create(createProjectDto);
  }

  @ApiOperation({ summary: "모든 프로젝트 조회" })
  @ApiResponse({ status: 200, description: "프로젝트 목록 반환" })
  @Get()
  findAll() {
    return this.adminProjectService.findAll();
  }

  @ApiOperation({ summary: "특정 프로젝트 조회" })
  @ApiResponse({ status: 200, description: "프로젝트 정보 반환" })
  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.adminProjectService.findOne(slug);
  }

  @ApiOperation({ summary: "프로젝트 slug 중복 확인" })
  @ApiResponse({ status: 200, description: "slug 중복 여부 반환" })
  @Get("over-slug/:slug")
  findOneOverSlug(@Param("slug") slug: string) {
    return this.adminProjectService.findOverSlug(slug);
  }

  @ApiOperation({ summary: "프로젝트 정보 수정" })
  @ApiResponse({ status: 200, description: "프로젝트가 성공적으로 수정됨" })
  @Patch(":slug")
  update(
    @Param("slug") slug: string,
    @Body() updateProjectDto: UpdateProjectDto
  ) {
    return this.adminProjectService.update(slug, updateProjectDto);
  }

  @ApiOperation({ summary: "프로젝트 노출 상태 수정" })
  @ApiResponse({
    status: 200,
    description: "프로젝트 노출 상태가 성공적으로 수정됨",
  })
  @Patch(":slug/show")
  updateShow(
    @Param("slug") slug: string,
    @Body() statusUpdateDto: StatusUpdateDto
  ) {
    return this.adminProjectService.updateShow(statusUpdateDto);
  }

  @ApiOperation({ summary: "프로젝트 삭제" })
  @ApiResponse({ status: 200, description: "프로젝트가 성공적으로 삭제됨" })
  @Delete(":slug")
  remove(@Param("slug") slug: string) {
    return this.adminProjectService.remove(slug);
  }
}
