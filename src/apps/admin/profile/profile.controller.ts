import { Controller, Get, Post, Body, Patch, Param, Delete } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { AdminProfileService } from "./profile.service";
import {
  AdminProfileCreateRequest,
  AdminProfileOrderUpdateRequest,
  AdminProfileResponse,
  AdminProfileUpdateRequest,
} from "./dto";

@Controller("admin/profile")
export class AdminProfileController {
  constructor(private readonly adminProfileService: AdminProfileService) {}

  @ApiOperation({ summary: "프로필 생성" })
  @Post()
  create(@Body() createProfileDto: AdminProfileCreateRequest) {
    return this.adminProfileService.create(createProfileDto);
  }

  @ApiOperation({ summary: "모든 프로필 조회" })
  @ApiOkResponse({
    description: "프로필 조회 성공",
    type: AdminProfileResponse,
    isArray: true,
  })
  @Get()
  findAll() {
    return this.adminProfileService.findAll();
  }

  @Patch(":id")
  update(
    @Param("id") id: number,
    @Body() updateProfileDto: AdminProfileUpdateRequest,
  ) {
    return this.adminProfileService.update(id, updateProfileDto);
  }

  @Patch(":id")
  updateOrder(
    @Param("id") id: number,
    @Body() updateOrderDto: AdminProfileOrderUpdateRequest,
  ) {
    return this.adminProfileService.updateOrder(id, updateOrderDto);
  }

  @ApiOperation({ summary: "프로필 삭제" })
  @Delete(":id")
  remove(@Param("id") id: number) {
    return this.adminProfileService.remove(id);
  }
}
