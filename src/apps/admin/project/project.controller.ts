import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Patch,
} from "@nestjs/common";
import { AdminProjectService } from "./project.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { StatusUpdateDto } from "./dto/show-project.dto";

@Controller("admin/project")
export class AdminProjectController {
  constructor(private readonly adminProjectService: AdminProjectService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.adminProjectService.create(createProjectDto);
  }

  @Get()
  findAll() {
    return this.adminProjectService.findAll();
  }

  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.adminProjectService.findOne(slug);
  }

  @Get("over-slug/:slug")
  findOneOverSlug(@Param("slug") slug: string) {
    return this.adminProjectService.findOverSlug(slug);
  }

  @Patch(":slug")
  update(
    @Param("slug") slug: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.adminProjectService.update(slug, updateProjectDto);
  }

  @Patch(":slug/show")
  updateShow(
    @Param("slug") slug: string,
    @Body() statusUpdateDto: StatusUpdateDto,
  ) {
    return this.adminProjectService.updateShow(statusUpdateDto);
  }

  @Delete(":slug")
  remove(@Param("slug") slug: string) {
    return this.adminProjectService.remove(slug);
  }
}
