import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from "@nestjs/common";
import { ProjectService } from "./project.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Controller("project")
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // 새로운 프로젝트 생성
  @Post()
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(createProjectDto);
  }

  // 모든 프로젝트 조회
  @Get()
  findAll() {
    return this.projectService.findAll();
  }

  // 특정 슬러그로 프로젝트 조회
  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.projectService.findOne(slug);
  }

  // 프로젝트의 노출 상태 업데이트
  @Post("show")
  updateShow(@Body() slug: string, is_show: boolean) {
    return this.projectService.updateShow(slug, is_show);
  }

  // 특정 슬러그로 프로젝트 업데이트
  @Patch(":slug")
  update(
    @Param("slug") slug: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.update(slug, updateProjectDto);
  }

  // 특정 슬러그로 프로젝트 삭제
  @Delete(":slug")
  remove(@Param("slug") slug: string) {
    return this.projectService.remove(slug);
  }
}
