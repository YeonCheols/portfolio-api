import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { TagService } from "./tag.service";
import { TagResponse, TagSearchRequest, TagSearchResponse } from "./dto";

@Controller("tag")
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @ApiOperation({ summary: "태그 목록 조회" })
  @ApiOkResponse({
    description: "태그 목록 조회 성공",
    type: TagResponse,
    isArray: true,
  })
  @Get()
  findAll() {
    return this.tagService.findAll();
  }

  @ApiOperation({ summary: "태그 검색" })
  @ApiOkResponse({
    description: "태그 검색 성공",
    type: TagSearchResponse,
  })
  @Get("search")
  findSearch(@Query() query: TagSearchRequest) {
    return this.tagService.findSearch(query);
  }

  @ApiOperation({ summary: "태그별 프로젝트 개수 통계" })
  @ApiOkResponse({
    description: "태그별 프로젝트 개수 조회 성공",
    type: TagResponse,
    isArray: true,
  })
  @Get("stats/counts")
  async getTagProjectCounts() {
    return this.tagService.getTagProjectCounts();
  }
}
