import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { ProjectService } from "./project.service";
import {
  ProjectByTagResponse,
  ProjectResponse,
  ProjectSearchRequest,
  ProjectSearchResponse,
  ProjectTagResponse,
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

  @ApiOperation({ summary: "stacks 기반으로 해당하는 태그들 조회" })
  @ApiOkResponse({
    description: "태그 조회 성공",
    type: ProjectTagResponse,
    isArray: true,
  })
  @Get("tags/by-stacks")
  async findTagsByStacks(@Query("stacks") stacks: string) {
    return this.projectService.findTagsByStacks(stacks);
  }

  @ApiOperation({ summary: "특정 태그를 사용하는 프로젝트들 조회" })
  @ApiOkResponse({
    description: "프로젝트 조회 성공",
    type: ProjectByTagResponse,
    isArray: true,
  })
  @Get("by-tag/:tagName")
  async findProjectsByTag(@Param("tagName") tagName: string) {
    console.info("tagName controller : ", tagName);
    return this.projectService.findProjectsByTag(tagName);
  }

  @ApiOperation({ summary: "여러 태그를 사용하는 프로젝트들 조회" })
  @ApiOkResponse({
    description: "프로젝트 조회 성공",
    type: ProjectByTagResponse,
    isArray: true,
  })
  @Get("by-tags")
  async findProjectsByTags(@Query("tags") tags: string) {
    const tagNames = tags.split(",").map((tag) => tag.trim());
    return this.projectService.findProjectsByTags(tagNames);
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
