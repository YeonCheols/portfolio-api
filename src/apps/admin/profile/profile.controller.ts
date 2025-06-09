import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
} from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { AdminProfileService } from "./profile.service";
import {
  AdminProfileCreateRequest,
  AdminProfileOrderUpdateRequest,
  AdminProfileResponse,
  AdminProfileStatusUpdateRequest,
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

  @ApiOperation({ summary: "프로필 정렬 변경" })
  @Patch("order")
  updateOrder(@Body() updateOrderDto: AdminProfileOrderUpdateRequest) {
    return this.adminProfileService.updateOrder(updateOrderDto);
  }

  @ApiOperation({ summary: "프로필 정보 수정" })
  @Put(":id")
  update(
    @Param("id") id: number,
    @Body() updateProfileDto: AdminProfileUpdateRequest,
  ) {
    return this.adminProfileService.update(id, updateProfileDto);
  }

  @ApiOperation({ summary: "프로필 상태 변경" })
  @Patch(":id")
  updateStatus(
    @Param("id") id: number,
    @Body() updateProfileStatusDto: AdminProfileStatusUpdateRequest,
  ) {
    return this.adminProfileService.updateStatus(id, updateProfileStatusDto);
  }

  @ApiOperation({ summary: "프로필 삭제" })
  @Delete(":id")
  remove(@Param("id") id: number) {
    return this.adminProfileService.remove(id);
  }
}
