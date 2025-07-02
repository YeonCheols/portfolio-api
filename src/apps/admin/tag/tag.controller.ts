import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiOkResponse, ApiBearerAuth } from "@nestjs/swagger";
import { AdminTagService } from "./tag.service";
import {
  AdminTagCreateRequest,
  AdminTagUpdateRequest,
  AdminTagResponse,
} from "./dto";
import { AdminAuthController } from "../auth/auth.controller";

@ApiBearerAuth("access-token")
@Controller("admin/tag")
export class AdminTagController extends AdminAuthController {
  constructor(private readonly adminTagService: AdminTagService) {
    super();
  }

  @ApiOperation({ summary: "태그 목록 조회" })
  @ApiOkResponse({ type: [AdminTagResponse] })
  @Get()
  findAll() {
    return this.adminTagService.findAll();
  }

  @ApiOperation({ summary: "태그 검색" })
  @ApiOkResponse({ type: [AdminTagResponse] })
  @Get("search")
  findSearch(@Query("keyword") keyword: string) {
    return this.adminTagService.findSearch(keyword);
  }

  @ApiOperation({ summary: "태그 생성" })
  @ApiOkResponse({ type: AdminTagResponse })
  @Post()
  create(@Body() dto: AdminTagCreateRequest) {
    return this.adminTagService.create(dto);
  }

  @ApiOperation({ summary: "특정 태그 조회" })
  @ApiOkResponse({ type: AdminTagResponse })
  @Get(":name")
  findOne(@Param("name") name: string) {
    return this.adminTagService.findOne(name);
  }

  @ApiOperation({ summary: "태그 수정" })
  @ApiOkResponse({ type: AdminTagResponse })
  @Put(":name")
  update(@Param("name") name: string, @Body() dto: AdminTagUpdateRequest) {
    return this.adminTagService.update(name, dto);
  }

  @ApiOperation({ summary: "태그 삭제" })
  @Delete(":name")
  remove(@Param("name") name: string) {
    return this.adminTagService.remove(name);
  }
}
