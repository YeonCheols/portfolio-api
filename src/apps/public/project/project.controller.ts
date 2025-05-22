import { Controller, Get, Param } from "@nestjs/common";
import { ProjectService } from "./project.service";

@Controller("project")
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // 모든 프로젝트 조회 (노출된 프로젝트만)
  @Get()
  findAll() {
    return this.projectService.findAll();
  }

  // 특정 프로젝트 조회
  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.projectService.findOne(slug);
  }
}
