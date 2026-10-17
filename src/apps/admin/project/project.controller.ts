/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { AdminProjectService } from "./project.service";
import {
  AdminProjectCreateRequest,
  AdminProjectUpdateRequest,
  AdminProjectStatusUpdateRequest,
  AdminProjectResponse,
  AdminProjectOrderUpdateRequest,
} from "./dto";
import { AdminAuthController } from "../auth/auth.controller";
import {
  AdminProjectSearchRequest,
  AdminProjectSearchResponse,
} from "./dto/project-search.dto";

@Controller("admin/project")
export class AdminProjectController extends AdminAuthController {
  constructor(private readonly adminProjectService: AdminProjectService) {
    super();
  }

  @ApiOperation({ summary: "프로젝트 생성" })
  @Post()
  create(@Body() createProjectDto: AdminProjectCreateRequest) {
    return this.adminProjectService.create(createProjectDto);
  }

  @ApiOperation({ summary: "프로젝트 조회" })
  @ApiOkResponse({
    description: "프로젝트 조회 성공",
    type: AdminProjectResponse,
    isArray: true,
  })
  @Get()
  findAll() {
    return this.adminProjectService.findAll();
  }

  @ApiOperation({ summary: "프로젝트 검색" })
  @ApiOkResponse({
    description: "프로젝트 검색 성공",
    type: AdminProjectSearchResponse,
  })
  @Get("search")
  findSearch(@Query() query: AdminProjectSearchRequest) {
    return this.adminProjectService.finedSearch(query);
  }

  @ApiOperation({ summary: "특정 프로젝트 조회" })
  @ApiOkResponse({
    description: "프로젝트조회 성공",
    type: AdminProjectResponse,
  })
  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.adminProjectService.findOne(slug);
  }

  @ApiOperation({ summary: "중복 프로젝트 조회" })
  @ApiOkResponse({
    description: "중복 프로젝트 조회 성공",
    type: Number,
  })
  @Get("over-slug/:slug")
  findOneOverSlug(@Param("slug") slug: string) {
    return this.adminProjectService.findOverSlug(slug);
  }

  @ApiOperation({ summary: "프로젝트 정렬 순서 업데이트" })
  @Patch("/order")
  updateOrder(@Body() orderUpdateDto: AdminProjectOrderUpdateRequest) {
    return this.adminProjectService.updateOrder(orderUpdateDto);
  }

  @ApiOperation({ summary: "프로젝트 업데이트" })
  @Patch(":slug")
  update(
    @Param("slug") slug: string,
    @Body() updateProjectDto: AdminProjectUpdateRequest,
  ) {
    return this.adminProjectService.update(slug, updateProjectDto);
  }

  @ApiOperation({ summary: "프로젝트 노출 여부 업데이트" })
  @Patch(":slug/show")
  updateShow(
    @Param("slug") slug: string,
    @Body() statusUpdateDto: AdminProjectStatusUpdateRequest,
  ) {
    return this.adminProjectService.updateShow(statusUpdateDto);
  }

  @ApiOperation({ summary: "프로젝트 삭제" })
  @Delete(":slug")
  remove(@Param("slug") slug: string) {
    return this.adminProjectService.remove(slug);
  }
}
