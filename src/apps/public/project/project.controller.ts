import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { ProjectService } from "./project.service";
import {
  ProjectResponse,
  ProjectSearchRequest,
  ProjectSearchResponse,
} from "./dto";

@Controller("project")
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @ApiOperation({ summary: "발행한 모든 프로젝트 조회" })
  @ApiOkResponse({
    description: "프로젝트조회 성공",
    type: ProjectResponse,
    isArray: true,
  })
  @Get()
  async findAll() {
    return this.projectService.findAll();
  }

  @ApiOperation({ summary: "프로젝트 검색" })
  @ApiOkResponse({
    description: "프로젝트 검색 성공",
    type: ProjectSearchResponse,
  })
  @Get("search")
  findSearch(@Query() query: ProjectSearchRequest) {
    return this.projectService.finedSearch(query);
  }

  @ApiOperation({ summary: "발행한 특정 프로젝트 조회" })
  @ApiOkResponse({
    description: "프로젝트조회 성공",
    type: ProjectResponse,
    isArray: true,
  })
  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.projectService.findOne(slug);
  }
}
