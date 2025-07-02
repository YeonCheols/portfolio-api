import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { TagService } from "./tag.service";
import { TagResponse } from "./dto";

@Controller("tag")
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @ApiOperation({ summary: "태그 목록 조회" })
  @ApiOkResponse({ type: [TagResponse] })
  @Get()
  findAll() {
    return this.tagService.findAll();
  }

  @ApiOperation({ summary: "태그 검색" })
  @ApiOkResponse({ type: [TagResponse] })
  @Get("search")
  findSearch(@Query("keyword") keyword: string) {
    return this.tagService.findSearch(keyword);
  }
}
